"""Build the Duskmail seaplane in game coordinates and export a standalone GLB."""

import math
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector


HUB = (0.0, 0.0, -1.86)
MATERIAL_COLORS = {
    "cream": (0.90, 0.76, 0.56, 1.0),
    "red": (0.64, 0.13, 0.10, 1.0),
    "metal": (0.28, 0.28, 0.34, 1.0),
    "glass": (0.08, 0.15, 0.21, 1.0),
    "livery": (0.75, 0.43, 0.15, 1.0),
    "navPort": (1.0, 0.05, 0.10, 1.0),
    "navStarboard": (0.07, 1.0, 0.32, 1.0),
    "navTail": (1.0, 1.0, 1.0, 1.0),
}

BOX_FACES = [
    (0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
    (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
]


def lathe(profile, segments=24, cap=True):
    vertices = []
    for z, radius, center_y in profile:
        for i in range(segments):
            angle = math.tau * i / segments
            vertices.append((radius * math.cos(angle), center_y + radius * math.sin(angle), z))

    faces = []
    for j in range(len(profile) - 1):
        for i in range(segments):
            a = j * segments + i
            b = j * segments + (i + 1) % segments
            faces.append((a, b, b + segments, a + segments))

    if cap:
        for ring in (0, len(profile) - 1):
            z, _, center_y = profile[ring]
            center = len(vertices)
            vertices.append((0, center_y, z))
            for i in range(segments):
                a = ring * segments + i
                b = ring * segments + (i + 1) % segments
                faces.append((center, b, a) if ring == 0 else (center, a, b))
    return vertices, faces


def interpolate_profile(profile, z):
    for (lo, r0, y0), (hi, r1, y1) in zip(profile, profile[1:]):
        if lo <= z <= hi:
            t = (z - lo) / (hi - lo)
            return z, r0 + (r1 - r0) * t, y0 + (y1 - y0) * t
    raise ValueError(f"Station {z} is outside the fuselage profile")


def band(profile, start, end, clearance):
    stations = [start, *(row[0] for row in profile if start < row[0] < end), end]
    return lathe([(z, radius + clearance, y)
                  for z, radius, y in (interpolate_profile(profile, z) for z in stations)], cap=False)


def sphere(center, radii, segments=20, rows=14):
    profile = [(math.cos(math.pi * j / rows), math.sin(math.pi * j / rows), 0)
               for j in range(rows - 1, 0, -1)]
    vertices, faces = lathe(profile, segments, cap=True)
    vertices[-2] = (0, 0, -1)
    vertices[-1] = (0, 0, 1)
    return transform(vertices, center, radii), faces


def transform(vertices, center, scale=(1, 1, 1)):
    return [tuple(center[i] + point[i] * scale[i] for i in range(3)) for point in vertices]


def mirror(data):
    vertices, faces = data
    return [(-x, y, z) for x, y, z in vertices], [face[::-1] for face in faces]


def solid(section_a, section_b):
    n = len(section_a)
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    faces.extend((i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n))
    return section_a + section_b, faces


def airfoil(x, leading, trailing, thickness, y):
    outline = [(0, 0), (0.12, 0.38), (0.34, 0.50), (0.75, 0.28),
               (1, 0), (0.73, -0.22), (0.30, -0.50), (0.09, -0.26)]
    return [(x, y + height * thickness, leading + chord * (trailing - leading))
            for chord, height in outline]


def extrude_fin(outline, thickness):
    return solid(
        [(-thickness / 2, y, z) for z, y in outline],
        [(thickness / 2, y, z) for z, y in outline],
    )


def clip_outline(outline, boundary, keep_above):
    clipped = []
    for a, b in zip(outline, outline[1:] + outline[:1]):
        inside_a = (a[1] >= boundary) if keep_above else (a[1] <= boundary)
        inside_b = (b[1] >= boundary) if keep_above else (b[1] <= boundary)
        if inside_a:
            clipped.append(a)
        if inside_a != inside_b:
            t = (boundary - a[1]) / (b[1] - a[1])
            clipped.append((a[0] + (b[0] - a[0]) * t, boundary))
    return clipped


def brace(start, end, width):
    start, end = Vector(start), Vector(end)
    axis = (end - start).normalized()
    guide = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))
    u = axis.cross(guide).normalized() * (width / 2)
    v = axis.cross(u).normalized() * (width / 2)
    corners = [-u - v, u - v, u + v, -u + v]
    return [tuple(center + corner) for center in (start, end) for corner in corners], BOX_FACES


def propeller():
    blade = []
    for radius, width, angle in ((0.10, 0.15, 0), (0.86, 0.10, math.radians(18))):
        for x, z in ((-width / 2, -0.02), (width / 2, -0.02),
                     (width / 2, 0.02), (-width / 2, 0.02)):
            blade.append((x * math.cos(angle) + z * math.sin(angle), radius,
                          z * math.cos(angle) - x * math.sin(angle)))
    return blade + [(-x, -y, z) for x, y, z in blade], BOX_FACES + [
        tuple(i + 8 for i in face) for face in BOX_FACES
    ]


def spinner():
    count = 24
    vertices = [(0.16 * math.cos(math.tau * i / count),
                 0.16 * math.sin(math.tau * i / count), 0.02) for i in range(count)]
    vertices += [(0, 0, -0.28), (0, 0, 0.02)]
    faces = [(count, (i + 1) % count, i) for i in range(count)]
    faces += [(count + 1, i, (i + 1) % count) for i in range(count)]
    return vertices, faces


def to_blender(point):
    x, y, z = point
    return x, -z, y


def main(output):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for material in list(bpy.data.materials):
        bpy.data.materials.remove(material)

    materials = {}
    for name, color in MATERIAL_COLORS.items():
        material = bpy.data.materials.new(name)
        material.diffuse_color = color
        materials[name] = material

    bounds_min = [math.inf] * 3
    bounds_max = [-math.inf] * 3
    triangle_count = 0

    def add(name, data, material, *, smooth=False, origin=(0, 0, 0), closed=True):
        nonlocal triangle_count
        vertices, faces = data
        for vertex in vertices:
            for axis in range(3):
                world = vertex[axis] + origin[axis]
                bounds_min[axis] = min(bounds_min[axis], world)
                bounds_max[axis] = max(bounds_max[axis], world)

        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata([to_blender(vertex) for vertex in vertices], [], faces)
        if closed:
            edit = bmesh.new()
            edit.from_mesh(mesh)
            bmesh.ops.recalc_face_normals(edit, faces=list(edit.faces))
            edit.to_mesh(mesh)
            edit.free()
        mesh.update()
        for polygon in mesh.polygons:
            polygon.use_smooth = smooth
        mesh.calc_loop_triangles()
        triangle_count += len(mesh.loop_triangles)
        obj = bpy.data.objects.new(name, mesh)
        obj.location = to_blender(origin)
        obj.data.materials.append(materials[material])
        bpy.context.collection.objects.link(obj)

    def pair(name, data, material, *, smooth=False):
        add(name + " Starboard", data, material, smooth=smooth)
        add(name + " Port", mirror(data), material, smooth=smooth)

    fuselage = [
        (-1.78, 0.05, 0), (-1.62, 0.30, 0), (-1.45, 0.46, 0), (-1.1, 0.50, 0),
        (-0.5, 0.52, 0.01), (0.1, 0.50, 0.03), (0.7, 0.42, 0.06), (1.15, 0.30, 0.09),
        (1.5, 0.19, 0.11), (1.72, 0.09, 0.12),
    ]
    midpoints = [interpolate_profile(fuselage, (a[0] + b[0]) / 2)
                 for a, b in zip(fuselage, fuselage[1:])]
    profile = sorted(fuselage + midpoints)
    add("Fuselage", lathe(profile), "cream", smooth=True)
    add("Cowl Band", band(profile, -1.62, -1.38, 0.008), "red", smooth=True, closed=False)
    add("Livery Band", band(profile, -0.18, 0.22, 0.006), "livery", smooth=True, closed=False)
    add("Canopy", sphere((0, 0.33, -0.42), (0.36, 0.27, 0.62)), "glass", smooth=True)

    wing_root = airfoil(0, -0.66, 0.30, 0.115, 0.30)
    wing_tip = airfoil(2.60, -0.60, 0.18, 0.075, 0.46)
    pair("Wing", solid(wing_root, wing_tip), "cream", smooth=True)
    pair("Wingtip", solid(wing_tip, airfoil(2.97, -0.58, 0.15, 0.07, 0.475)), "red", smooth=True)
    add("Tailplane", solid(airfoil(-0.95, 1.18, 1.70, 0.09, 0.17),
                           airfoil(0.95, 1.18, 1.70, 0.09, 0.17)), "cream", smooth=True)
    fin = [(1.16, 0.18), (1.30, 0.78), (1.52, 0.80), (1.74, 0.20)]
    add("Fin", extrude_fin(fin, 0.09), "red")
    add("Fin Band", extrude_fin(clip_outline(clip_outline(fin, 0.42, True), 0.54, False), 0.096), "cream")

    float_profile = [
        (-1.58, 0.03), (-1.35, 0.17), (-0.9, 0.25), (-0.2, 0.27), (0.35, 0.24),
        (0.38, 0.20), (0.9, 0.20), (1.30, 0.10), (1.42, 0.02),
    ]
    vertices, faces = lathe([(z, radius, -0.80) for z, radius in float_profile])
    pair("Float", (transform(vertices, (0.91, 0, 0)), faces), "cream", smooth=True)

    for station, z in enumerate((-0.62, 0.52), 1):
        for offset, label in ((-0.046, "Fore"), (0.046, "Aft")):
            pair(f"Float Strut {station} {label}",
                 brace((0.40, -0.30, z), (0.91, -0.60, z + offset), 0.07), "metal")
    for station, z in enumerate((-0.40, 0.18), 1):
        pair(f"Wing Strut {station}", brace((0.80, -0.52, z), (1.80, 0.26, z), 0.048), "metal")

    add("Propeller", propeller(), "metal", origin=HUB)
    add("PropellerSpinner", spinner(), "red", origin=HUB, smooth=True)
    for name, x, y, z, material in (
        ("Port Light", -2.99, 0.49, -0.20, "navPort"),
        ("Starboard Light", 2.99, 0.49, -0.20, "navStarboard"),
        ("Tail Light", 0, 0.20, 1.78, "navTail"),
    ):
        add(name, sphere((x, y, z), (0.085,) * 3, 12, 8), material, smooth=True)
    add("Antenna", brace((0, 0.55, 0.35), (0, 0.86, 0.42), 0.022), "metal")
    if triangle_count >= 20000:
        raise ValueError(f"Triangle budget exceeded: {triangle_count}")

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", export_apply=True)
    print("Game-space bounds:", tuple(round(v, 4) for v in bounds_min),
          "to", tuple(round(v, 4) for v in bounds_max))
    print("Total triangles:", triangle_count)


if __name__ == "__main__":
    arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if len(arguments) != 1:
        raise SystemExit("Usage: blender -b --factory-startup --python tools/aircraft_model.py -- OUTPUT.glb")
    main(Path(arguments[0]).resolve())
