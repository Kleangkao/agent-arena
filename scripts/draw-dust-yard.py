from pathlib import Path
import json
import random
from PIL import Image, ImageDraw, ImageEnhance

OUT = Path("public/assets/dust-yard")
OUT.mkdir(parents=True, exist_ok=True)
SIZE = (480, 270)
RNG = random.Random(14)


def iso(x, y, z=0):
    return round(240 + (x - y) * 18), round(43 + (x + y) * 9 - z)


def shape(draw, points, color):
    draw.polygon([iso(*p) for p in points], fill=color)


def slab(draw, x, y, w, d, h, colors, base=0):
    shape(draw, [(x, y, h), (x+w, y, h), (x+w, y+d, h), (x, y+d, h)], colors[0])
    shape(draw, [(x, y+d, h), (x+w, y+d, h), (x+w, y+d, base), (x, y+d, base)], colors[1])
    shape(draw, [(x+w, y, h), (x+w, y+d, h), (x+w, y+d, base), (x+w, y, base)], colors[2])


floor = Image.new("RGB", SIZE)
ground = ImageDraw.Draw(floor)
for y in range(270):
    shade_shift = min(13,y//12)
    ground.line((0, y, 480, y), (147+shade_shift, 115+shade_shift//2, 83+shade_shift//2))
concept = Image.open("assets/source/dust-yard-concept.png").convert("RGB")
skyline = concept.crop((0,0,concept.width,150)).resize((480,48),Image.Resampling.LANCZOS)
skyline = ImageEnhance.Color(skyline).enhance(.62)
haze = Image.new("L", skyline.size)
haze_draw = ImageDraw.Draw(haze)
for y in range(48):
    haze_draw.line((0,y,479,y),fill=round(220*max(0,1-(y/47)**2)))
floor.paste(skyline,(0,0),haze)
# Packed earth extends to the camera edges. Lower contrast keeps it outside the lane.
surround = random.Random(72)
for _ in range(2400):
    x,y = surround.uniform(-7,20),surround.uniform(-5,22)
    point=iso(x,y)
    if point[1]>=42:
        ground.point(point,surround.choice(["#a48059","#957352","#a6835e"]))
for offset in (12,12.55,13.12):
    for side in (0,1):
        a,b = ((-4,offset),(offset,offset)) if side == 0 else ((offset,-4),(offset,offset))
        ground.line([iso(*a),iso(*b)],fill="#a4835f")
shape(ground, [(-.12, -.12), (12.08, -.12), (12.08, 12.08), (-.12, 12.08)], "#9c784e")
shape(ground, [(0, 0), (12, 0), (12, 12), (0, 12)], "#ae854f")
stones = ["#c5a06f", "#c9a473", "#d0ab77", "#d3ad7b", "#cca575", "#d4b180"]
for gy in range(18):
    y = gy * 2/3
    x = 0
    while x < 12:
        w = min(12-x, RNG.choice([.62, .8, 1, 1.2, 1.42]))
        color = RNG.choice(stones)
        shape(ground, [(x+.05,y+.05),(x+w-.04,y+.05),(x+w-.03,y+.58),
                       (x+w-.13,y+.63),(x+.03,y+.62)], color)
        ground.line([iso(x+.08,y+.06),iso(x+w-.10,y+.06)], fill="#e1bc87")
        if RNG.random() < .52:
            px, py = iso(x+w*.5,y+.4)
            ground.line([(px-2,py),(px,py+1),(px+2,py)], fill="#b68e62")
        x += w
for _ in range(550):
    x, y = RNG.uniform(.1, 11.9), RNG.uniform(.1, 11.9)
    ground.point(iso(x, y), RNG.choice(["#b88f61", "#e0ba86", "#dcb381"]))

# Paint the A in ground space so it shares the projection of the masonry joints.
for a,b in [((7.8,8.6),(8.1,7.9)),((8.1,7.9),(8.8,8.2)),((7.94,8.28),(8.56,8.1))]:
    ground.line([iso(*a),iso(*b)], fill="#a15b47", width=3)
for k in range(4):
    ground.point(iso(8.0+k*.11,8.4-k*.07), fill="#dbb282")

shadows = Image.new("RGBA", SIZE)
shade = ImageDraw.Draw(shadows)
shape(shade, [(0,0),(12,0),(12.4,1.7),(.48,1.7)], (76,52,53,41))
for x,y,w,d in [(0,0,12,.7), (0,1,.7,7), (.85,5.58,1.9,1.15), (7.8,.88,2.1,1.25),
                (9.5,8.9,1.05,1.1), (11.05,3,.62,.66)]:
    shape(shade, [(x,y), (x+w,y), (x+w+.50,y+d+.89), (x+.22,y+d+.89)], (76,52,53,61))
    shape(shade, [(x,y), (x+w,y), (x+w+.12,y+d+.12), (x,y+d+.12)], (67,45,39,95))
Image.alpha_composite(floor.convert("RGBA"), shadows).convert("RGB").save(OUT/"courtyard.png", optimize=True)

objects = []


def save(name, img, foot):
    bounds = img.getbbox()
    img.crop(bounds).save(OUT/(name+".png"), optimize=True)
    objects.append({"key":name,"left":bounds[0],"top":bounds[1],"foot":foot})


def masonry(draw, x,y,w,d,h, tint=0):
    palette = [
        ("#e3ba80","#bd8d5d","#957052"),
        ("#ecc892","#c59a6e","#a37b54"),
        ("#e5bd87","#b48760","#8d654a"),
    ][tint]
    slab(draw,x,y,w,d,h,palette)
    for z in range(5,h-2,5):
        draw.line([iso(x,y+d,z),iso(x+w,y+d,z)], fill="#9f7451")
        draw.line([iso(x+w,y,z),iso(x+w,y+d,z)], fill="#79563e")
        for side in (0,1):
            length = w if side == 0 else d
            for q in range(1, int(length*6)):
                shift = (q+(z//5%2)*.5)/6
                a = (x+shift,y+d) if side == 0 else (x+w,y+shift)
                if RNG.random() < .48 and shift < length-.04:
                    draw.line([iso(*a,z),iso(*a,z+4)], fill="#a37755" if side == 0 else "#7f6048")
    for _ in range(round(w*d*90+w*h)):
        u, z = RNG.uniform(.08,w-.08), RNG.uniform(1,h-1)
        draw.point(iso(x+u,y+d,z), RNG.choice(["#b1875e","#d0a579","#b98b62"]))
    slab(draw,x-.035,y-.025,w+.07,d+.05,h+2,("#f3d39d","#d0a476","#a47b58"),h-1)


rear = Image.new("RGBA", SIZE)
g = ImageDraw.Draw(rear)
for y in reversed(range(1,8)):
    masonry(g,0,y,.72,1,32+(6 if y in (1,4,7) else 0),y%3)
for x in range(12):
    height = 41 if x in (0,4,7,11) else 34
    masonry(g,x,0,1,.77,height,x%3)
    if x in (0,4,7,11):
        slab(g,x-.07,-.06,1.14,.91,height+4,("#f0d19c","#c79a6b","#9e7452"),height+1)
        for u in (.12,.6):
            slab(g,x+u,.4,.27,.38,height+8,("#eacb95","#c8a37b","#a57b56"),height+4)
for x in (1.5,3.35,8.8,10.5):
    shape(g, [(x-.2,.79,14),(x+.25,.79,14),(x+.25,.79,26),(x-.2,.79,26)], "#604c42")
    for z in range(16,26,3):
        g.line([iso(x-.14,.80,z),iso(x+.19,.80,z)], fill="#738378")
    g.line([iso(x-.25,.81,13),iso(x+.31,.81,13)], fill="#e4bd8b",width=2)
arch = [(4.47,.83,0),(4.47,.83,20),(4.69,.83,30),(5.13,.83,37),(5.91,.83,41),
        (6.64,.83,38),(7.04,.83,32),(7.37,.83,22),(7.37,.83,0)]
shape(g,arch,"#e6bc82")
opening = [(4.7,.86,0),(4.7,.86,19),(4.96,.86,28),(5.38,.86,34),(5.91,.86,36),
           (6.48,.86,33),(6.91,.86,27),(7.14,.86,19),(7.14,.86,0)]
shape(g,opening,"#4f382b")
gate = [(x+.08 if x<5.92 else x-.08,y+.02,max(0,h-3)) for x,y,h in opening]
shape(g,gate,"#765037")
for i in range(14):
    x = 4.82+i*.16
    h = 30-round(10*((x-5.91)/1.13)**2)
    g.line([iso(x,.9,1),iso(x,.9,h)], fill=RNG.choice(["#62432e","#936344","#885a3c"]))
for z in (9,19):
    g.line([iso(4.77,.91,z),iso(7.06,.91,z)], fill="#4a3930", width=2)
    for x in (4.86,5.19,5.67,6.19,6.74,6.98):
        g.point(iso(x,.93,z), "#c69b66")
g.line([iso(5.91,.94,1),iso(5.91,.94,33)], fill="#432f25")
for a,b in [((2.24,.79,6),(2.53,.79,18)),((2.53,.79,18),(2.85,.79,6)),((2.37,.80,10),(2.73,.80,10))]:
    g.line([iso(*a),iso(*b)],fill="#985c47",width=2)

# Layered canopy, struts and folded cloth. The awning is outside the lane.
for x in (8.36,9.65):
    g.line([iso(x,.81,14),iso(x,1.42,22)],fill="#584e41",width=2)
shape(g,[(8.22,.78,29),(9.78,.78,29),(9.81,1.48,23),(8.19,1.48,23)],"#898f78")
for i in range(7):
    x=8.23+i*.23
    shape(g,[(x,.79,29),(x+.10,.79,29),(x+.10,1.48,23),(x,1.48,23)],"#566f68")
    g.line([iso(x,1.48,23),iso(x+.14,1.48,22)],fill="#675c49",width=2)
save("north-wall",rear,115)


def crate(draw,x,y,w,d,h):
    slab(draw,x,y,w,d,h,("#af8150","#8c5d39","#6e4830"))
    for v in range(4):
        t = (v+1)/5
        draw.line([iso(x+w*t,y,h),iso(x+w*t,y+d,h)],fill="#7e5335")
        draw.line([iso(x,y+d,h*t),iso(x+w,y+d,h*t)],fill="#67442d")
        draw.line([iso(x+w,y,h*t),iso(x+w,y+d,h*t)],fill="#533a2c")
        draw.line([iso(x+.07,y+d,h*t+1),iso(x+w-.06,y+d,h*t+1)],fill="#a6774c")
    for p,q in [((x,y+d,h),(x+w,y+d,h)),((x,y+d,1),(x+w,y+d,1)),
                ((x,y+d,0),(x,y+d,h)),((x+w,y+d,0),(x+w,y+d,h)),
                ((x+.08,y+d,2),(x+w-.07,y+d,h-2))]:
        draw.line([iso(*p),iso(*q)],fill="#c09561",width=2)
    for p,q in [((x+w,y,h),(x+w,y+d,h)),((x+w,y,1),(x+w,y+d,1)),
                ((x+w,y,0),(x+w,y,h)),((x+w,y+d,2),(x+w,y,h-2))]:
        draw.line([iso(*p),iso(*q)],fill="#8d623f",width=2)
    for u in (x+.08,x+w-.07):
        for z in (2,h-2):
            draw.point(iso(u,y+d,z), "#4e3e30")


for name, crates in [
    ("west-freight",[(.85,5.58,1,1.05,18),(1.87,5.82,.81,.91,15)]),
    ("east-freight",[(7.8,.88,1.05,1.05,22),(8.91,1.01,.91,1,16)]),
    ("front-freight",[(9.5,8.9,1.05,1.05,17)]),
]:
    img = Image.new("RGBA", SIZE)
    for x,y,w,d,h in crates:
        crate(ImageDraw.Draw(img),x,y,w,d,h)
    save(name,img,max(iso(x+w,y+d)[1] for x,y,w,d,h in crates))
img = Image.new("RGBA", SIZE)
masonry(ImageDraw.Draw(img),11.05,3,.62,.66,19,1)
save("corner-pier",img,iso(11.67,3.66)[1])
(OUT/"objects.json").write_text(json.dumps(objects, indent=2)+"\n")
