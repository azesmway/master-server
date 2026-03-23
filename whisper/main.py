import os, tempfile, time
from pathlib import Path
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

MODEL_SIZE = os.getenv('WHISPER_MODEL', 'small')
print(f'Loading Whisper: {MODEL_SIZE}')
model = WhisperModel(MODEL_SIZE, device='cpu', compute_type='int8')
print('Whisper ready!')

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

CATEGORIES = {
    'сантехник':'1','труба':'1','кран':'1','электрик':'1','ремонт':'1',
    'уборка':'4','убрать':'4','маникюр':'2','стрижка':'2',
    'репетитор':'3','математика':'3','программист':'5','сайт':'5',
    'перевозка':'6','переезд':'6','фото':'7','видео':'7',
    'юрист':'8','дизайн':'10','бухгалтер':'11',
}

@app.get('/health')
def health(): return {'status':'ok','model':MODEL_SIZE}

@app.post('/transcribe-and-analyze')
async def transcribe_and_analyze(audio: UploadFile = File(...), language: str = Form(default='ru')):
    contents = await audio.read()
    if len(contents) < 1000:
        raise HTTPException(422, 'Файл слишком маленький')
    suffix = Path(audio.filename or 'audio.m4a').suffix or '.m4a'
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(contents); path = tmp.name
    try:
        start = time.time()
        segments, info = model.transcribe(path, language=language, beam_size=3, vad_filter=True)
        text = ' '.join(s.text.strip() for s in segments).strip()
        print(f'[Whisper] {round(time.time()-start,1)}s: "{text[:60]}"')
        if not text: raise HTTPException(422, 'Не удалось распознать речь')
        lower = text.lower()
        cat_id = next((v for k,v in CATEGORIES.items() if k in lower), None)
        title  = ' '.join(text.split()[:8])[:60]
        return {'text':text,'title':title,'categoryId':cat_id,'language':info.language}
    finally:
        try: os.unlink(path)
        except: pass

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=int(os.getenv('PORT','8001')))
