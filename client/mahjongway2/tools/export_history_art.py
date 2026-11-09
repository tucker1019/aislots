"""从现有游戏PNG导出HTML详情使用的牌面，不改动源美术。"""
from pathlib import Path
from PIL import Image
import base64,io,json,plistlib,re
root=Path(__file__).resolve().parents[1]
source=root/'assets/mahjongway/res/texture/cell'
normal={2:'l_bamboo_2',3:'l_ball_2',4:'l_bamboo_5',5:'l_ball_5',6:'h_char_8',7:'h_white',8:'h_red',9:'h_green',10:'s_wild',11:'s_scatter'}
def encode(image):
 out=io.BytesIO();image.save(out,format='PNG',optimize=True)
 return 'data:image/png;base64,'+base64.b64encode(out.getvalue()).decode()
icons={k:Image.open(source/(v+'.png')).convert('RGBA') for k,v in normal.items()}
# 三饼复用同套五饼中的三个真实圆点，不使用文本或不同风格的替代图。
five=icons[5];three=Image.new('RGBA',(162,190))
for box,pos in [((37,27,79,70),(38,28)),((63,65,107,110),(61,68)),((89,105,134,148),(85,108))]:
 three.alpha_composite(five.crop(box),pos)
icons[1]=three
art={}
for symbol,icon in icons.items():
 if symbol>=10:
  if symbol==11:
   background=Image.open(source/'scatter_bg.png').convert('RGBA')
   x=(background.width-icon.width)//2;y=(background.height-icon.height)//2
   card=background.crop((x,y,x+icon.width,y+icon.height))
   # 背景是黑底发光贴图，HTML单独按screen混合，不能直接压成不透明牌面。
   art['scatter_background']=encode(card)
   art[str(symbol)]=encode(icon)
  else:
   art[str(symbol)]=encode(icon)
   art['wild_base']=encode(Image.open(source/'symbol_base_ingot.png').convert('RGBA'))
  continue
 for gold in [False,True]:
  card=Image.open(source/('symbol_base_gold.png' if gold else 'symbol_base_white.png')).convert('RGBA')
  card.alpha_composite(icon)
  if gold:card.alpha_composite(Image.open(source/'symbol_base_gold_ingot.png').convert('RGBA'))
  art[str(symbol+(1000 if gold else 0))]=encode(card)
# 图集裁剪沿用实际游戏素材；TexturePacker旋转图块先还原方向。
def atlas_frame(prefix, name):
 atlas=next((root/'assets/mahjongway/res/texture/base').glob(prefix+'*.plist'))
 data=plistlib.loads(atlas.read_bytes());frame=data['frames'][name]
 x,y,w,h=map(int,re.findall(r'-?\d+',frame['frame']))
 image=Image.open(atlas.parent/data['metadata']['textureFileName']).convert('RGBA')
 if frame['rotated']:
  image=image.crop((x,y,x+h,y+w)).transpose(Image.Transpose.ROTATE_90)
 else:image=image.crop((x,y,x+w,y+h))
 return image
for mode,prefix in [('gray','1319'),('light','787f')]:
 for factor in [1,2,3,4,5,6,10]:
  art[f'multiplier_{mode}_{factor}']=encode(atlas_frame(prefix,f'x{factor}.png'))
# 免费模式的未激活x2是独立红色素材，不与普通模式的棕色x2共用。
art['multiplier_free_gray_2']=encode(atlas_frame('1319','x2_b.png'))
art['multiplier_background']=encode(atlas_frame('6737','main_top_c.png'))
arrow=Path('/Users/yaozhao/cccProject/mahjongway1_1025/assets/mahjongway/res/image/setting_menu/auto_arrow.png')
art['arrow']=encode(Image.open(arrow).convert('RGBA'))
(root/'assets/resources/history/art.json').write_text(json.dumps(art,separators=(',',':'))+'\n')
print('Exported',len(art),'history images')
