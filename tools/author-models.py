# Blender 4.x headless authoring for Weather-Boy hero set pieces.
# Run: blender -b -P tools/author-models.py
# Exports one GLB per model into models/ — real bevels, curves and smooth
# shading that box-composition can't reach. Units: metres, Y-up on export.
import bpy, math, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models')
os.makedirs(OUT, exist_ok=True)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, rgb, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1.0)
    b.inputs['Roughness'].default_value = 0.8
    if emit > 0:
        b.inputs['Emission Color'].default_value = (*rgb, 1.0)
        b.inputs['Emission Strength'].default_value = emit
    return m

def setmat(o, m):
    o.data.materials.clear(); o.data.materials.append(m)

def bevel(o, w=0.03, seg=2):
    md = o.modifiers.new('bv', 'BEVEL'); md.width = w; md.segments = seg
    md.limit_method = 'ANGLE'; md.angle_limit = math.radians(40)

def smooth(o):
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_smooth()
    if hasattr(o.data, 'use_auto_smooth'):
        o.data.use_auto_smooth = True; o.data.auto_smooth_angle = math.radians(45)

def cyl(r, d, loc, m, verts=24, rot=(0,0,0), r2=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d, location=loc, rotation=rot)
    o = bpy.context.object
    if r2 is not None:  # taper
        for v in o.data.vertices:
            if v.co.z > 0: v.co.x *= r2 / r; v.co.y *= r2 / r
    setmat(o, m); return o

def box(sx, sy, sz, loc, m, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    setmat(o, m); return o

def sph(r, loc, m, seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=seg//2, location=loc)
    o = bpy.context.object; setmat(o, m); return o

def torus(r, tr, loc, m, rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=tr, location=loc, rotation=rot,
                                     major_segments=28, minor_segments=12)
    o = bpy.context.object; setmat(o, m); return o

def pipe(points, r, m):
    cu = bpy.data.curves.new('pipe', 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = r; cu.bevel_resolution = 4; cu.resolution_u = 12
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(points) - 1)
    for i, p in enumerate(points):
        bp = sp.bezier_points[i]; bp.co = p
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = bpy.data.objects.new('pipe', cu); bpy.context.collection.objects.link(o)
    setmat(o, m)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object

def export(name):
    for o in bpy.context.scene.objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + '.glb'),
                              export_format='GLB', export_yup=True, export_apply=True)
    print('exported', name)

# linear-space values (three renders these directly): dark wartime metals
IRON  = (0.043, 0.031, 0.025); STEEL = (0.075, 0.09, 0.095); BRASS = (0.26, 0.147, 0.033)
DARK  = (0.009, 0.009, 0.011); COPPER= (0.17, 0.055, 0.027); BLOOD = (0.051, 0.004, 0.004)
GLOW_A= (1.0, 0.62, 0.22);  GLOW_C= (0.30, 0.85, 0.95); CONC  = (0.147, 0.14, 0.12)

# ---- 1. The Giant's Heart REGULATOR: riveted chamber, dome, curved feed pipes
reset()
m_iron, m_brass, m_glow = mat('iron', IRON), mat('brass', BRASS), mat('glow', GLOW_A, 3.0)
m_dark = mat('dark', DARK)
b = cyl(0.55, 0.5, (0, 0, 0.25), m_dark, 20); bevel(b, 0.04)          # plinth
c = cyl(0.62, 1.5, (0, 0, 1.25), m_iron, 28); bevel(c, 0.05); smooth(c)  # chamber
for i in range(3):
    rib = torus(0.64, 0.045, (0, 0, 0.7 + i * 0.55), m_brass, (0, 0, 0)); smooth(rib)
d = sph(0.62, (0, 0, 2.0), m_iron); smooth(d)                          # dome
v = cyl(0.1, 0.3, (0, 0, 2.72), m_brass, 12); smooth(v)                # valve stub
for a in (0, math.pi/2, math.pi, 3*math.pi/2):                         # curved feed pipes
    x, y = math.cos(a), math.sin(a)
    p = pipe([(0.55*x, 0.55*y, 1.9), (1.05*x, 1.05*y, 1.45), (1.15*x, 1.15*y, 0.4), (1.15*x, 1.15*y, 0.0)], 0.07, m_brass)
    smooth(p)
g = torus(0.2, 0.035, (0, -0.66, 1.3), m_brass, (math.pi/2, 0, 0)); smooth(g)  # gauge ring
gf = cyl(0.16, 0.03, (0, -0.68, 1.3), m_glow, 16, (math.pi/2, 0, 0))          # gauge face
sl = box(0.34, 0.16, 0.12, (0, -0.62, 0.62), m_dark)                   # tag slot
export('regulator')

# ---- 2. Operating island: beveled table, basin, curved lamp arm
reset()
m_steel, m_dark, m_blood = mat('steel', STEEL), mat('dark', DARK), mat('blood', BLOOD)
m_glow = mat('lamp', GLOW_A, 4.0)
base = box(2.2, 1.1, 0.18, (0, 0, 0.09), mat('conc', CONC)); bevel(base, 0.05)
leg = cyl(0.16, 0.6, (0, 0, 0.45), m_dark, 12)
top = box(1.9, 0.85, 0.1, (0, 0, 0.85), m_steel); bevel(top, 0.04); smooth(top)
pad = box(1.5, 0.6, 0.04, (-0.1, 0, 0.92), m_blood); bevel(pad, 0.02)
bs = cyl(0.18, 0.14, (0.72, 0.22, 0.92), m_steel, 16); smooth(bs)      # drain basin
arm = pipe([(1.0, -0.45, 0.0), (1.05, -0.5, 1.6), (0.6, -0.2, 2.3), (0.1, 0.0, 2.45)], 0.045, m_dark); smooth(arm)
head = cyl(0.3, 0.18, (0.02, 0.0, 2.42), m_steel, 20, (0.35, 0, 0), r2=0.42); smooth(head)
lens = cyl(0.22, 0.03, (0.0, -0.03, 2.34), m_glow, 20, (0.35, 0, 0))
export('optable')

# ---- 3. Furnace crucible: tapered pot, pour lip, chain, glowing melt
reset()
m_iron, m_glow = mat('iron', IRON), mat('melt', GLOW_A, 5.0)
m_dark = mat('dark', DARK)
pot = cyl(0.75, 1.4, (0, 0, 0.75), m_iron, 26, r2=1.0); bevel(pot, 0.05); smooth(pot)
lip = torus(1.0, 0.07, (0, 0, 1.45), m_iron); smooth(lip)
spout = box(0.5, 0.34, 0.12, (1.05, 0, 1.4), m_iron, (0, 0.35, 0)); smooth(spout)
melt = cyl(0.9, 0.05, (0, 0, 1.42), m_glow, 26)
tr = torus(0.16, 0.035, (-1.02, 0, 1.5), m_dark, (0, math.pi/2, 0)); smooth(tr)   # trunnion rings
tr2 = torus(0.16, 0.035, (1.02, 0, 1.5), m_dark, (0, math.pi/2, 0)); smooth(tr2)
for i in range(5):                                                      # chain to the hoist
    ln = torus(0.09, 0.025, (0, 0, 1.9 + i * 0.3), m_dark, (0, (i % 2) * math.pi/2, 0)); smooth(ln)
export('crucible')

# ---- 4. Diesel generator: finned block, curved exhaust, skid base
reset()
m_steel, m_dark, m_copper = mat('steel', STEEL), mat('dark', DARK), mat('copper', COPPER)
m_glow = mat('gauge', GLOW_A, 3.0)
skid = box(2.6, 1.5, 0.16, (0, 0, 0.08), m_dark); bevel(skid, 0.03)
blk = box(2.1, 1.15, 1.15, (0, 0, 0.75), m_steel); bevel(blk, 0.06); smooth(blk)
for i in range(6):                                                      # cooling fins
    fin = box(0.04, 1.25, 0.9, (-0.85 + i * 0.34, 0, 0.8), m_dark)
head = box(1.6, 0.9, 0.35, (0, 0, 1.5), m_dark); bevel(head, 0.05)
ex = pipe([(0.75, 0.3, 1.6), (0.85, 0.34, 2.3), (0.7, 0.2, 2.9), (0.72, 0.0, 3.3)], 0.11, m_copper); smooth(ex)
cap = cyl(0.16, 0.1, (0.72, 0.0, 3.38), m_copper, 14, r2=0.2); smooth(cap)
gg = cyl(0.14, 0.04, (-1.06, 0.45, 1.1), m_glow, 14, (0, math.pi/2, 0))
export('generator')

# ---- 5. Cooling basin: beveled round pool, standing water, pump
reset()
m_conc, m_dark = mat('conc', CONC), mat('dark', DARK)
m_wat = mat('water', (0.35, 0.60, 0.58), 0.6)
wall = cyl(1.8, 0.62, (0, 0, 0.31), m_conc, 32); bevel(wall, 0.06); smooth(wall)
inner = cyl(1.55, 0.5, (0, 0, 0.42), m_dark, 32); smooth(inner)
wat = cyl(1.5, 0.04, (0, 0, 0.56), m_wat, 32)
pump = cyl(0.17, 1.3, (0, 0, 0.95), m_dark, 12); smooth(pump)
pt = pipe([(0, 0, 1.55), (0.3, 0, 1.62), (0.55, 0, 1.4), (0.6, 0, 1.05)], 0.06, m_conc); smooth(pt)
export('basin')

print('ALL MODELS EXPORTED')
