from pathlib import Path
from PIL import Image, ImageDraw
from colorsys import rgb_to_hsv, hsv_to_rgb

SOURCE = Image.open("assets/source/faction-art.png").convert("RGBA")
OUT = Path("public/assets/factions")
OUT.mkdir(parents=True, exist_ok=True)
CELL = (48, 64)
FRAME = (64, 64)
NEAREST = Image.Resampling.NEAREST


def piece(sprite, polygon):
    mask = Image.new("L", CELL)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    layer = Image.new("RGBA", CELL)
    layer.paste(sprite, mask=mask)
    return layer


def shift(layer, dx=0, dy=0):
    out = Image.new("RGBA", CELL)
    out.alpha_composite(layer, (dx, dy))
    return out


def costume(source, team):
    width, height = source.size
    pixels = source.load()
    for y in range(height):
        for x in range(width):
            r,g,b,a = pixels[x,y]
            if not a:
                continue
            hue,sat,value = rgb_to_hsv(r/255,g/255,b/255)
            warm = .025 < hue < .17 and sat > .30
            if team == "blue":
                if .42 < hue < .57 and sat > .3 and y < height*.20:
                    # Replace the lit visor with matte protective glass.
                    hue,sat,value = .61,min(sat,.26),min(.53,value*.65)
                elif warm and (y > height*.94 or y < height*.32 or x > width*.55):
                    hue,sat,value = .60,sat*.40,value*.72
                elif warm and .30*height < y < .85*height:
                    hue,sat,value = .59,sat*.48,value*.74
            elif warm:
                # Leave facial warmth and pull the scarf and cloth toward desert canvas.
                if not (y < height*.20 and x > width*.49 and sat < .59):
                    hue,sat,value = min(.13,hue+.04),sat*.65,value*.9
            if .42 < hue < .57 and sat > .3 and .21*height < y < .38*height:
                hue,sat,value = .59,sat*.28,value*.69
            rr,gg,bb = hsv_to_rgb(hue,sat,value)
            pixels[x,y] = round(rr*255),round(gg*255),round(bb*255),a
    return source


for team, left, right in (("blue", 120, 610), ("sand", 830, 1420)):
    source = SOURCE.crop((left, 0, right, 1024))
    source.putalpha(source.getchannel("A").point(lambda a: 255 if a >= 137 else 0))
    source = costume(source.crop(source.getbbox()),team)
    height = 55
    art = source.resize((round(source.width*height/source.height), height), Image.Resampling.LANCZOS)
    art.putalpha(art.getchannel("A").point(lambda a: 255 if a >= 128 else 0))
    sprite = Image.new("RGBA", CELL)
    sprite.alpha_composite(art, ((48-art.width)//2, 6))

    upper = piece(sprite, [(0,0),(47,0),(47,33),(0,33)])
    near = piece(sprite, [(0,30),(25,30),(24,43),(21,63),(0,63)])
    far = piece(sprite, [(24,30),(47,30),(47,63),(19,63),(22,43)])
    grip = piece(sprite, [(21,18),(46,18),(46,27),(27,30),(20,27),(19,23)])
    body = piece(upper, [(0,0),(47,0),(47,17),(20,17),(18,23),(19,28),
                         (26,31),(47,28),(47,34),(0,34)])

    def pose(bob=0, near_x=0, near_y=0, far_x=0, far_y=0, hands=None, lean=0):
        frame = shift(far,far_x,far_y)
        frame.alpha_composite(shift(near,near_x,near_y))
        frame.alpha_composite(shift(upper if hands is None else body,lean,bob))
        if hands is not None:
            angle, dx, dy = hands
            moved = grip.rotate(angle, resample=NEAREST, center=(24,24))
            frame.alpha_composite(shift(moved,dx+lean,dy+bob))
        return frame

    def padded(frame):
        out = Image.new("RGBA",FRAME)
        out.alpha_composite(frame,(8,0))
        return out

    def fall(angle):
        body = padded(sprite).rotate(angle,resample=NEAREST,center=(32,33),expand=True)
        body = body.crop(body.getbbox())
        if angle >= 80:
            body = body.resize((body.width,round(body.height*.68)),NEAREST)
        frame = Image.new("RGBA",FRAME)
        frame.alpha_composite(body,((64-body.width)//2,61-body.height))
        return frame

    frames = [
        pose(), pose(bob=1),                                   # Idle
        pose(-1,4,-1,-4,0,lean=1), pose(0,0,0,2,-4,lean=1), # Walk
        pose(-1,-4,0,4,-1,lean=1), pose(0,2,-4,0,0,lean=1),
        pose(-1,hands=(4,1,-1)),pose(hands=(-3,-2,0),lean=-1), # Attack
        pose(1,hands=(-14,-1,2)),pose(1,hands=(-27,-3,3)),    # Reload
        pose(hands=(-8,0,1)),
        pose(0,hands=(9,-1,0),lean=-2),pose(1,lean=-1),       # Hit
    ]
    sheet = Image.new("RGBA",(4*FRAME[0],4*FRAME[1]))
    for i, frame in enumerate([*(padded(frame) for frame in frames),fall(14),fall(42),fall(80)]):
        sheet.alpha_composite(frame,((i%4)*FRAME[0],(i//4)*FRAME[1]))
    sheet.save(OUT/f"{team}-sheet.png",optimize=True)

    portrait = source.crop((0,0,source.width,round(source.height*.56)))
    portrait.thumbnail((122,128), Image.Resampling.LANCZOS)
    portrait.save(OUT/f"{team}-portrait.png",optimize=True)
