import numpy as np, wave, sys
SR=22050; OUT=sys.argv[1]
def save(name, x):
    x=np.clip(x,-1,1); d=(x*32767*0.9).astype('<i2')
    w=wave.open(OUT+'/'+name,'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(d.tobytes()); w.close()
def f(m): return 440*2**((m-69)/12)
def tone(m,dur,kind,vol):
    t=np.arange(int(SR*dur))/SR; fr=f(m)
    if kind=='square': s=np.sign(np.sin(2*np.pi*fr*t))*0.6
    elif kind=='tri': s=2*np.abs(2*((t*fr)%1)-1)-1
    else: s=np.sin(2*np.pi*fr*t)
    env=np.exp(-t*(3.0/dur)); a=np.minimum(1,t/0.005)
    return s*env*a*vol
mel=[72,0,76,79,76,0,72,0,74,0,77,81,77,0,74,0,76,0,79,84,79,0,76,0,74,77,76,74,72,0,67,0]
mel2=[79,0,77,76,74,0,76,0,77,0,81,79,77,0,76,0,74,0,72,74,76,0,79,0,77,76,74,72,71,0,72,0]
bass=[48,55,53,55,52,55,50,55,48,55,53,55,55,53,48,43]
step=0.15; n=32*4; L=int(SR*step*n)+SR; buf=np.zeros(L)
for s in range(n):
    i=int(s*step*SR)
    M=(mel if (s//32)%2==0 else mel2)[s%32]
    if M: x=tone(M,0.14,'square',0.22); buf[i:i+len(x)]+=x
    if s%2==0: x=tone(bass[(s//2)%16],0.17,'tri',0.4); buf[i:i+len(x)]+=x
    # hi-hat / kick
    if s%4==0:
        t=np.arange(int(SR*0.12))/SR; k=np.sin(2*np.pi*(120*np.exp(-t*25))*t*3)*np.exp(-t*30)*0.5; buf[i:i+len(k)]+=k
    if s%2==1:
        t=np.arange(int(SR*0.04))/SR; h=np.random.uniform(-1,1,len(t))*np.exp(-t*90)*0.08; buf[i:i+len(h)]+=h
buf=buf[:int(SR*step*n)]
save('musica.wav', buf)
t=np.arange(int(SR*0.35))/SR; fr=620*np.exp(np.log(90/620)*t/0.3); ph=np.cumsum(fr)/SR
save('alto.wav', (2*(ph%1)-1)*np.exp(-t*9)*0.6)
save('sentado.wav', tone(84,0.14,'square',0.5))
fan=np.zeros(int(SR*0.9))
for k,m in enumerate([72,76,79,84]):
    x=tone(m,0.3 if k<3 else 0.5,'square',0.4); i=int(k*0.14*SR); fan[i:i+len(x)]+=x[:len(fan)-i]
save('ganaste.wav', fan)
save('paso.wav', tone(88,0.08,'sine',0.5))
print('ok')
