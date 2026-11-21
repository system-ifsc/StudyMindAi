"""Renderização local: Python 3 + Pillow + FFmpeg. Sem downloads ou serviços."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, subprocess, wave, struct

ROOT = Path(__file__).resolve().parent
W, H, FPS, DURATION = 1280, 720, 30, 42
BG, WHITE, MINT, MUTED = '#081c19', '#f4f5e9', '#adf786', '#9bb4ac'
FONTS = {}
def font(size, bold=False):
    key = (size, bold)
    if key not in FONTS:
        FONTS[key] = ImageFont.truetype('/usr/share/fonts/noto/NotoSans-' + ('Black' if bold else 'Regular') + '.ttf', size)
    return FONTS[key]
def ease(v):
    return 1 - (1 - max(0, min(1, v))) ** 3
def text(d, xy, s, size=24, color=WHITE, bold=False):
    d.text(xy, s, font=font(size, bold), fill=color)
def card(d, box, fill='#12352d', outline='#2d5044', radius=22):
    d.rounded_rectangle(box, radius, fill=fill, outline=outline, width=2)
def star(d, x, y, r, t, color=MINT):
    for i in range(8):
        a = i * math.pi / 4 + t * .2
        d.line((x+math.cos(a)*r*.35, y+math.sin(a)*r*.35,
                x+math.cos(a)*r, y+math.sin(a)*r), fill=color, width=7)

SCENE_SECONDS = 6

SCENES = [
    ('PRAZOS. PROVAS. CONTEÚDO ACUMULADO.', ['Por onde', 'começar?'], 'Dê um próximo passo nos seus estudos.'),
    ('STUDYMIND AI', ['Menos dispersão.', 'Mais direção.'], 'Organize, estude e revise no mesmo lugar.'),
    ('01 / PLANEJE SEU PRÓXIMO PASSO', ['Sua rotina.', 'Seu plano.'], 'Distribua tarefas no tempo que você tem.'),
    ('02 / TRANSFORME TEMPO EM FOCO', ['Uma tarefa.', 'Um momento.'], 'Pomodoro, pausas e registro de sessões.'),
    ('03 / REVISE E COLOQUE EM PRÁTICA', ['Vá além', 'da releitura.'], 'Repetição espaçada, exercícios e simulados.'),
    ('04 / ESTUDE COM SEUS MATERIAIS', ['Do conteúdo', 'à prática.'], 'Use IA para criar resumos, cartões e questões.'),
    ('COMECE PELO SEU PRÓXIMO ESTUDO', ['Abra. Explore.', 'Comece hoje.'], 'studyminds.vercel.app'),
]

def center(d, y, value, size=60, color=WHITE, bold=True, cx=640):
    width = d.textlength(value, font=font(size, bold))
    text(d, (cx-width/2, y), value, size, color, bold)

def kinetic(layer, value, y, u, size=64, color=WHITE, delay=0, cx=640):
    """Reveal a phrase with a short upward movement and an opacity ramp."""
    progress = ease((u-delay)/.65)
    if progress <= 0:
        return
    tile = Image.new('RGBA', (W, H)); td = ImageDraw.Draw(tile)
    center(td, y+int(38*(1-progress)), value, size, color, cx=cx)
    tile.putalpha(tile.getchannel('A').point(lambda a: int(a*progress)))
    layer.alpha_composite(tile)

def background(t):
    # Low-resolution moving light fields, smoothly upscaled; no external imagery.
    glow = Image.new('RGB', (160, 90), '#040c0c'); gd = ImageDraw.Draw(glow)
    x = 48 + int(28*math.sin(t*.23)); y = 44+int(15*math.cos(t*.31))
    gd.ellipse((x-48,y-30,x+48,y+30), fill='#185f46')
    gd.ellipse((90+int(18*math.cos(t*.19)),35,159,105), fill='#173938')
    glow = glow.filter(ImageFilter.GaussianBlur(19)).resize((W,H), Image.Resampling.BICUBIC)
    return glow

def frame(t):
    idx = min(6, int(t / SCENE_SECONDS)); u = t - idx * SCENE_SECONDS
    im = background(t)
    layer = Image.new('RGBA', (W,H)); d = ImageDraw.Draw(layer)
    text(d,(62,32),'StudyMind AI',22,WHITE,True)
    text(d,(1010,37),'SEU PRÓXIMO PASSO',12,MUTED)
    if idx == 0:
        if u < 2.5:
            kinetic(layer,'Provas.',205,u,84)
            kinetic(layer,'Prazos.',305,u,84,MINT,.35)
            kinetic(layer,'Tudo ao mesmo tempo?',435,u,30,WHITE,.85)
        else:
            v=u-2.5
            kinetic(layer,'Por onde',215,v,76)
            kinetic(layer,'começar?',310,v,100,MINT,.18)
            kinetic(layer,'Dê um próximo passo nos seus estudos.',465,v,26,WHITE,.55)
    elif idx == 1:
        kinetic(layer,'Menos dispersão.',178,u,70)
        kinetic(layer,'Mais direção.',270,u,84,MINT,.25)
        for i,label in enumerate(['Organize','Estude','Revise']):
            v=ease((u-.8-i*.2)/.7); xx=224+i*288; yy=435+int(40*(1-v))
            if v>0:
                card(d,(xx,yy,xx+256,yy+76),fill='#153d32',outline='#3b7960',radius=38)
                center(d,yy+17,label,27,MINT,cx=xx+128)
        kinetic(layer,'Sua rotina conectada, em português.',558,u,22,MUTED,1.6)
    elif idx == 2:
        kinetic(layer,'Sua rotina. Seu plano.',120,u,58)
        kinetic(layer,'Distribua tarefas no tempo que você tem.',205,u,25,MUTED,.2)
        for i,(title,detail) in enumerate([('Prazos','O que vem primeiro'),('Disponibilidade','O tempo que você tem'),('Blocos de estudo','Um plano para seguir')]):
            v=ease((u-.45-i*.22)/.8); xx=112+i*360; yy=315+int(100*(1-v))
            if v>0:
                card(d,(xx,yy,xx+336,yy+206),fill='#102b25',outline='#41745e')
                text(d,(xx+26,yy+22),f'0{i+1}',26,MINT,True)
                text(d,(xx+26,yy+86),title,24,WHITE,True)
                text(d,(xx+26,yy+134),detail,19,MUTED)
        center(d,577,'Planejador por algoritmo determinístico.',22,MUTED,False)
    elif idx == 3:
        kinetic(layer,'Uma tarefa.',170,u,62,cx=365)
        kinetic(layer,'Um momento.',250,u,62,MINT,.22,cx=365)
        kinetic(layer,'Pomodoro, pausas e',374,u,26,WHITE,.5,cx=365)
        kinetic(layer,'registro de sessões.',414,u,26,WHITE,.65,cx=365)
        d.ellipse((820,179,1160,519),outline='#294b40',width=10)
        d.arc((820,179,1160,519),-90,-90+int(330*ease(u/4)),fill=MINT,width=10)
        center(d,285,'25:00',66,WHITE,cx=990)
        center(d,384,'TEMPO DE FOCO',16,MINT,cx=990)
        for i in range(3):
            d.ellipse((952+i*30,559,962+i*30,569),fill=MINT if i<int(u)%3+1 else '#294b40')
    elif idx == 4:
        kinetic(layer,'Vá além da releitura.',112,u,62)
        kinetic(layer,'Lembre. Confira. Pratique.',200,u,27,MUTED,.2)
        for i in range(2,-1,-1):
            offset=i*12; card(d,(350+offset,300-offset,930+offset,508-offset),fill='#102b25',outline='#34634e')
        center(d,326,'FLASHCARD / EXEMPLO',15,MINT)
        center(d,372,'Tente lembrar.' if u<3 else 'Depois, confira.',38,WHITE)
        center(d,441,'Repetição espaçada',21,MUTED,False)
        kinetic(layer,'Exercícios, simulados e acompanhamento de acertos.',572,u,23,WHITE,.65)
    elif idx == 5:
        kinetic(layer,'Do conteúdo à prática.',112,u,62)
        kinetic(layer,'Use IA com seus materiais.',204,u,27,MUTED,.25)
        card(d,(92,330,380,466),fill='#dbe7bb',outline=None)
        center(d,350,'SEUS MATERIAIS',22,BG,cx=236)
        center(d,404,'PDF · DOCX · PPTX · TXT',17,BG,False,cx=236)
        d.line((399,398,490,398),fill=MINT,width=3)
        d.polygon([(490,398),(477,389),(477,407)],fill=MINT)
        for i,title in enumerate(['Resumos','Flashcards','Questões']):
            v=ease((u-.5-i*.25)/.65); xx=526+i*226; yy=330+int(60*(1-v))
            if v>0:
                card(d,(xx,yy,xx+206,yy+136),fill='#153d32',outline='#3b7960')
                center(d,yy+48,title,24,MINT,cx=xx+103)
        center(d,553,'IA disponível com provedor configurado.',23,WHITE,False)
        center(d,591,'Revise o conteúdo gerado.',18,MUTED,False)
    else:
        kinetic(layer,'Menos dispersão.',133,u,62)
        kinetic(layer,'Mais direção.',214,u,80,MINT,.2)
        kinetic(layer,'Abra. Explore. Comece hoje.',337,u,29,WHITE,.45)
        card(d,(290,418,990,493),fill=MINT,outline=None,radius=38)
        center(d,431,'studyminds.vercel.app',32,BG)
        center(d,521,'Explore a demonstração sem criar conta.',22,WHITE,False)
        center(d,595,'Gabriel Moraes e Gabriel Henrique',18,MUTED,False)
    # Very short editorial dissolve; the final CTA stays still for reading.
    opacity=ease(u/.18)*(1-ease((u-5.78)/.22) if idx<6 else 1)
    layer.putalpha(layer.getchannel('A').point(lambda a:int(a*opacity)))
    im.paste(layer,(0,0),layer)
    d=ImageDraw.Draw(im)
    text(d,(62,673),'STUDYMIND AI  /  ILUSTRAÇÕES DOS RECURSOS',12,MUTED)
    d.rounded_rectangle((1040,682,1218,685),2,fill='#29483c')
    d.rounded_rectangle((1040,682,1041+int(177*t/DURATION),685),2,fill=MINT)
    return im

def soundtrack():
    """Original soft electronic music, synthesized locally, no sampled assets."""
    rate=24000
    chords=[(130.81,164.81,196),(110,130.81,164.81),(87.31,110,130.81),(98,123.47,146.83)]
    data=bytearray()
    for n in range(rate*DURATION):
        t=n/rate; beat=t%.5; bar=t%2
        chord=chords[int(t/4)%4]
        pad=sum(math.sin(2*math.pi*f*t) for f in chord)*.035
        note=chord[int(t/.25)%3]*4
        pluck=math.sin(2*math.pi*note*t)*math.exp(-14*(t%.25))*.06
        kick=math.sin(2*math.pi*(48*beat+2*(1-math.exp(-30*beat))))*math.exp(-20*beat)*.18
        tick=math.sin(2*math.pi*7000*t)*math.exp(-90*(t%.25))*.025
        fade=min(1,t/1.5,(DURATION-t)/2)
        val=int(max(-1,min(1,(pad+pluck+kick+tick)*fade))*32767)
        data.extend(struct.pack('<h',val))
    with wave.open(str(ROOT/'trilha.wav'),'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(rate); f.writeframes(data)

def render_segment(index):
    output=ROOT/'__pycache__'/f'scene-{index}.mp4'
    output.parent.mkdir(exist_ok=True)
    command=['ffmpeg','-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p',str(output)]
    p=subprocess.Popen(command,stdin=subprocess.PIPE)
    try:
        for n in range(FPS*SCENE_SECONDS):
            p.stdin.write(frame(index*SCENE_SECONDS+n/FPS).tobytes())
    finally:
        p.stdin.close()
    if p.wait(): raise RuntimeError('FFmpeg falhou')
    print(f'Cena {index+1}/7 finalizada.',flush=True)

def assemble():
    soundtrack()
    listing=ROOT/'__pycache__'/'concat.txt'
    listing.write_text(''.join(f"file scene-{i}.mp4\n" for i in range(7)))
    subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(listing),'-i',str(ROOT/'trilha.wav'),'-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart','-shortest',str(ROOT/'studymind-propaganda.mp4')],check=True)
    frame(39).save(ROOT/'capa.jpg',quality=95)
    sheet=Image.new('RGB',(1280,1440),BG)
    for i,t in enumerate([1.5,4,9,15,21,27,33,39]):
        sheet.paste(frame(t).resize((640,360)),((i%2)*640,(i//2)*360))
    sheet.save(ROOT/'storyboard.jpg',quality=90)
    print('Vídeo finalizado.',flush=True)

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('--segment',type=int,choices=range(7))
    parser.add_argument('--assemble',action='store_true')
    args=parser.parse_args()
    if args.segment is not None:
        render_segment(args.segment)
    elif args.assemble:
        assemble()
    else:
        for i in range(7): render_segment(i)
        assemble()
