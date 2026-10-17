import json,urllib.request,urllib.error
from pathlib import Path
p=Path(__file__).resolve().parent.parent
token=json.loads((p/'extension/connection.local.json').read_text(encoding='utf-8'))['token']
base='https://dasi-purpose-ai-1017.edupro25909.chatgpt.site'
def req(path,data=None,auth=True):
 headers={'User-Agent':'Mozilla/5.0','Content-Type':'application/json','Origin':'https://vivian715037-maker.github.io'}
 if auth:headers['X-Demo-Token']=token
 r=urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers=headers)
 try:
  with urllib.request.urlopen(r,timeout=25) as f:return f.status,json.load(f)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
status,health=req('/api/health');assert status==200 and health['configured'],(status,health)
results=[]
for title,expected in [('중학교 수학 일차방정식 개념 강의','related'),('리그오브레전드 게임 하이라이트 웃긴 영상 모음','unrelated')]:
 status,data=req('/api/judge',{'goal':'중학교 수학 공부','url':'https://youtube.com/','title':title})
 assert status==200,(status,data)
 assert data['related']==expected,data
 results.append({'title':title,**data})
status,_=req('/api/judge',{'goal':'수학','url':'https://youtube.com','title':'게임'},False);assert status==401,status
status,_=req('/api/judge',{'goal':'','url':'bad','title':''});assert status==400,status
(p/'test-results/production-ai.json').write_text(json.dumps({'health':health,'results':results,'unauthorized':401,'invalidInput':400},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'production':'PASS','results':results,'guards':[401,400]},ensure_ascii=False))
