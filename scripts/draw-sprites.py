from pathlib import Path
from PIL import Image, ImageDraw

# Original 1-pixel source sprites, rendered at integer scale in the game.
for name, palette in {
    'blue': ('#172631','#274555','#49748a','#91b8c1','#c79870'),
    'sand': ('#36281d','#664632','#aa7450','#d9a973','#ba8057'),
}.items():
    dark, mid, light, trim, skin = palette
    sheet = Image.new('RGBA',(34*8,34))
    for frame in range(8):
        img=Image.new('RGBA',(34,34))
        d=ImageDraw.Draw(img)
        def box(x,y,w,h,c): d.rectangle((x,y,x+w-1,y+h-1),fill=c)
        if frame==7:
            box(6,26,20,5,dark);box(10,24,11,5,light);box(22,25,6,5,mid)
        else:
            stride=(0,0,2,-2,0,0,0)[frame]
            bob=1 if frame in (1,3) else 0
            box(9,23,6,7+stride,dark);box(17,23,6,7-stride,dark)
            box(8,29+stride,7,2,mid);box(17,29-stride,7,2,mid)
            box(8,12+bob,17,12,dark);box(10,12+bob,12,10,light)
            box(12,15+bob,9,6,mid);box(13,16+bob,7,2,trim)
            box(10,21+bob,11,2,dark);box(14,21+bob,3,1,trim)
            box(7,14+bob,4,6,mid);box(22,14+bob,4,6,mid)
            box(11,4+bob,12,8,dark);box(12,5+bob,11,4,light)
            box(14,8+bob,9,4,skin);box(15,8+bob,8,2,dark)
            box(19,8+bob,4,1,trim)
            if name=='sand':
                box(10,4+bob,12,3,trim);box(9,7+bob,4,7,light);box(13,11+bob,10,2,mid)
            else:
                box(13,3+bob,8,1,mid);box(11,7+bob,13,1,mid)
            y=19 if frame==5 else 15+bob
            box(23,y,8,3,dark);box(23,y+1,3,2,skin);box(28,y,4,1,trim)
            if frame==4:
                box(30,y-1,4,4,'#faac54');box(31,y,3,2,'#fff0a6')
            if frame==6: box(10,13,13,7,'#df805a')
        sheet.paste(img,(frame*34,0))
        if frame==0: img.save(Path('public')/f'{name}-portrait.png')
    sheet.save(Path('public')/f'{name}-sprites.png')
