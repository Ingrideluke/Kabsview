import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, Animated, ImageBackground,
  ScrollView, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useFonts, PlayfairDisplay_900Black, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';

// ─── CONFIG ─────────────────────────────────────────────────────────────────
// After deploying your server, replace this with your Railway/Render URL:
const DEFAULT_SERVER = 'wss://YOUR-APP.railway.app';
// ────────────────────────────────────────────────────────────────────────────

const { width: SW, height: SH } = Dimensions.get('window');

const BG_COLORS = {
  night:  ['#1a1610', '#2d2318'],
  forest: ['#0d2b2b', '#1a4a3a'],
  amber:  ['#2b1a0d', '#4a2a1a'],
  ocean:  ['#0d1a2b', '#1a2a4a'],
  wine:   ['#2b0d1a', '#4a1a2a'],
  paper:  ['#f5f0e8', '#ede0cc'],
};

const WEATHER_ICONS = {
  clear:'☀️', sunny:'☀️', clouds:'☁️', rain:'🌧️',
  drizzle:'🌦️', thunderstorm:'⛈️', snow:'❄️', mist:'🌫️',
  fog:'🌫️', haze:'🌫️',
};

// ─── SETUP SCREEN ────────────────────────────────────────────────────────────
function SetupScreen({ onConnect }) {
  const [server, setServer] = useState(DEFAULT_SERVER);
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function connect() {
    const k = key.trim().toUpperCase();
    if (k.length !== 6) { setError('Enter the 6-letter channel key'); return; }
    const srv = server.trim().replace(/\/$/, '');
    if (!srv) { setError('Enter your server URL'); return; }
    setLoading(true);
    setError('');
    try {
      // Quick HTTP check
      const httpUrl = srv.replace('wss://', 'https://').replace('ws://', 'http://');
      const r = await fetch(`${httpUrl}/api/channel/${k}`);
      const d = await r.json();
      if (!d.exists) { setError('Channel not found — check the key'); setLoading(false); return; }
      onConnect(srv, k);
    } catch(e) {
      setError('Cannot reach server — check the URL');
    }
    setLoading(false);
  }

  return (
    <View style={s.setup}>
      <StatusBar hidden />
      <Text style={s.setupLogo}>Home Display</Text>
      <Text style={s.setupSub}>ANDROID CLIENT</Text>

      <View style={s.setupCard}>
        <Text style={s.setupHint}>SERVER URL</Text>
        <TextInput
          style={s.setupInput}
          value={server}
          onChangeText={setServer}
          placeholder="wss://your-app.railway.app"
          placeholderTextColor="rgba(245,240,232,0.25)"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <Text style={[s.setupHint, { marginTop: 16 }]}>CHANNEL KEY</Text>
        <TextInput
          style={[s.setupInput, s.keyInput]}
          value={key}
          onChangeText={t => setKey(t.toUpperCase())}
          placeholder="XXXXXX"
          placeholderTextColor="rgba(245,240,232,0.25)"
          maxLength={6}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={connect}
        />

        {!!error && <Text style={s.setupErr}>{error}</Text>}

        <TouchableOpacity style={s.setupBtn} onPress={connect} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.setupBtnTxt}>Connect & Play →</Text>
          }
        </TouchableOpacity>

        <Text style={s.setupNote}>
          Get the key + URL from admin panel → Channel section
        </Text>
      </View>
    </View>
  );
}

// ─── TEXT SLIDE ──────────────────────────────────────────────────────────────
function TextSlide({ slide, anim }) {
  const colors = BG_COLORS[slide.bg] || BG_COLORS.night;
  const isPaper = slide.bg === 'paper';
  const fg = isPaper ? '#1a1610' : '#fff';
  const sfg = isPaper ? 'rgba(26,22,16,0.6)' : 'rgba(255,255,255,0.6)';
  const align = slide.align || 'center';

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <View style={[s.slide, { backgroundColor: colors[0] }]}>
      {/* gradient overlay */}
      <View style={[StyleSheet.absoluteFill, {
        backgroundColor: colors[1], opacity: 0.6,
        transform: [{ skewY: '-10deg' }, { translateY: SH * 0.3 }]
      }]} />
      <Animated.View style={{ opacity: anim, transform: [{ translateY }], paddingHorizontal: SW * 0.08, alignItems: align === 'center' ? 'center' : align === 'left' ? 'flex-start' : 'flex-end' }}>
        <Text style={[s.slideHL, { color: fg, textAlign: align }]}>
          {slide.headline}
        </Text>
        {!!slide.subtext && (
          <Text style={[s.slideSub, { color: sfg, textAlign: align }]}>
            {slide.subtext}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

// ─── IMAGE SLIDE ─────────────────────────────────────────────────────────────
function ImageSlide({ slide, anim }) {
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, slide.kenburns ? 1.08 : 1] });
  return (
    <Animated.View style={[s.slide, { opacity: anim }]}>
      <Animated.Image
        source={{ uri: slide.url }}
        style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}
        resizeMode={slide.fit === 'contain' ? 'contain' : 'cover'}
      />
      {!!slide.caption && (
        <View style={s.caption}>
          <Text style={s.captionTxt}>{slide.caption}</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─── CLOCK SLIDE ─────────────────────────────────────────────────────────────
function ClockSlide({ slide, anim }) {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if ((slide.widget === 'weather' || slide.widget === 'both') && slide.city) {
      fetch(`https://wttr.in/${encodeURIComponent(slide.city)}?format=j1`)
        .then(r => r.json())
        .then(d => {
          const c = d.current_condition?.[0];
          if (!c) return;
          const temp = slide.unit === 'F' ? `${Math.round(c.temp_F)}°F` : `${Math.round(c.temp_C)}°C`;
          const desc = c.weatherDesc?.[0]?.value || '';
          const key = desc.toLowerCase().split(' ').find(w => WEATHER_ICONS[w]) || 'sunny';
          setWeather({ temp, desc, icon: WEATHER_ICONS[key] || '🌤️' });
        })
        .catch(() => {});
    }
  }, [slide.city]);

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const showC = slide.widget !== 'weather';
  const showW = slide.widget === 'weather' || slide.widget === 'both';

  return (
    <Animated.View style={[s.slide, s.clockSlide, { opacity: anim }]}>
      {showC && (
        <>
          <Text style={s.clockTime}>{timeStr}</Text>
          <Text style={s.clockDate}>{dateStr}</Text>
        </>
      )}
      {showW && weather && (
        <View style={s.weatherBlock}>
          <Text style={s.weatherIcon}>{weather.icon}</Text>
          <View>
            <Text style={s.weatherTemp}>{weather.temp}</Text>
            <Text style={s.weatherDesc}>{weather.desc}</Text>
            {!!slide.city && <Text style={s.weatherCity}>{slide.city.toUpperCase()}</Text>}
          </View>
        </View>
      )}
      {showW && !weather && (
        <ActivityIndicator color="rgba(245,240,232,0.4)" style={{ marginTop: 20 }} />
      )}
    </Animated.View>
  );
}

// ─── WEB SLIDE ───────────────────────────────────────────────────────────────
function WebSlide({ slide, anim }) {
  return (
    <Animated.View style={[s.slide, { opacity: anim }]}>
      <WebView source={{ uri: slide.url }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

// ─── VIDEO SLIDE ─────────────────────────────────────────────────────────────
function VideoSlide({ slide, anim }) {
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#000">
    <iframe src="${slide.url}${slide.url.includes('?') ? '&' : '?'}autoplay=1${slide.muted ? '&mute=1' : ''}${slide.loop ? '&loop=1' : ''}"
      style="width:100vw;height:100vh;border:none" allow="autoplay;fullscreen" allowfullscreen></iframe>
  </body></html>`;
  return (
    <Animated.View style={[s.slide, { opacity: anim }]}>
      <WebView source={{ html }} style={StyleSheet.absoluteFill} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} />
    </Animated.View>
  );
}

// ─── SLIDE RENDERER ──────────────────────────────────────────────────────────
function SlideRenderer({ slide, anim }) {
  if (!slide) return null;
  switch (slide.type) {
    case 'text':  return <TextSlide  slide={slide} anim={anim} />;
    case 'image': return <ImageSlide slide={slide} anim={anim} />;
    case 'clock': return <ClockSlide slide={slide} anim={anim} />;
    case 'url':   return <WebSlide   slide={slide} anim={anim} />;
    case 'video': return <VideoSlide slide={slide} anim={anim} />;
    default: return <View style={[s.slide, { backgroundColor: '#111' }]}><Text style={{ color: '#555' }}>{slide.type}</Text></View>;
  }
}

// ─── OVERLAY CLOCK ───────────────────────────────────────────────────────────
function OverlayClock({ settings }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  if (!settings.clock && !settings.date) return null;
  return (
    <View style={s.overlayClock} pointerEvents="none">
      {settings.clock && <Text style={s.ovTime}>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>}
      {settings.date && <Text style={s.ovDate}>{now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</Text>}
    </View>
  );
}

// ─── TICKER ──────────────────────────────────────────────────────────────────
function Ticker({ settings }) {
  const x = useRef(new Animated.Value(SW)).current;
  useEffect(() => {
    if (!settings.ticker || !settings.tickerMsg) return;
    x.setValue(SW);
    const anim = Animated.loop(Animated.timing(x, { toValue: -SW * 3, duration: 25000, useNativeDriver: true }));
    anim.start();
    return () => anim.stop();
  }, [settings.ticker, settings.tickerMsg]);

  if (!settings.ticker || !settings.tickerMsg) return null;
  const msg = `${settings.tickerMsg}   ·   ${settings.tickerMsg}   ·   ${settings.tickerMsg}`;
  return (
    <View style={s.ticker}>
      <Animated.Text style={[s.tickerTxt, { transform: [{ translateX: x }] }]}>{msg}</Animated.Text>
    </View>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState('setup');  // 'setup' | 'display'
  const [slides, setSlides] = useState([]);
  const [settings, setSettings] = useState({ loop: true, clock: true, date: true, ticker: false, tickerMsg: '', transition: 'fade' });
  const [idx, setIdx] = useState(0);
  const [hudVisible, setHudVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [connStatus, setConnStatus] = useState('Connecting…');
  const [serverUrl, setServerUrl] = useState('');
  const [channelKey, setChannelKey] = useState('');

  const opacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const playTimer  = useRef(null);
  const pingTimer  = useRef(null);
  const wsRef      = useRef(null);
  const hudTimer   = useRef(null);
  const slidesRef  = useRef(slides);
  const idxRef     = useRef(idx);
  const pausedRef  = useRef(paused);
  const settingsRef= useRef(settings);

  slidesRef.current  = slides;
  idxRef.current     = idx;
  pausedRef.current  = paused;
  settingsRef.current= settings;

  // Keep screen awake
  useEffect(() => {
    activateKeepAwakeAsync();
    return () => deactivateKeepAwake();
  }, []);

  // WebSocket
  const wsConnect = useCallback((url, key) => {
    const wsUrl = `${url}/`;
    const proto = url.startsWith('wss') ? 'wss' : 'ws';
    const host = url.replace('wss://', '').replace('ws://', '').replace('https://', '').replace('http://', '');
    const ws = new WebSocket(`${proto}://${host}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnStatus('Live');
      ws.send(JSON.stringify({ type: 'join', key, role: 'display' }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'state' || msg.type === 'load') {
        setSlides(msg.slides || []);
        setSettings(msg.settings || {});
        setIdx(0);
      }
      if (msg.type === 'cmd') handleCmd(msg.cmd);
      if (msg.type === 'error') setConnStatus(msg.message);
    };

    ws.onclose = () => {
      setConnStatus('Reconnecting…');
      setTimeout(() => wsConnect(url, key), 3000);
    };
    ws.onerror = () => ws.close();
  }, []);

  const handleCmd = (cmd) => {
    if (cmd === 'pause') { setPaused(true); clearTimeout(playTimer.current); }
    else if (cmd === 'resume') { setPaused(false); }
    else if (cmd === 'next') { advanceSlide(1); }
  };

  function onConnect(srv, key) {
    setServerUrl(srv);
    setChannelKey(key);
    setPhase('display');
    wsConnect(srv, key);
    pingTimer.current = setInterval(() => {
      if (wsRef.current?.readyState === 1) {
        wsRef.current.send(JSON.stringify({ type: 'ping', key, slideIdx: idxRef.current }));
      }
    }, 4000);
  }

  // Slide playback
  const showSlide = useCallback((i) => {
    clearTimeout(playTimer.current);
    const sl = slidesRef.current;
    if (!sl.length) return;
    const newIdx = ((i % sl.length) + sl.length) % sl.length;
    setIdx(newIdx);

    // Fade in
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }).start();

    const slide = sl[newIdx];
    const dur = slide.type === 'video' && !slide.duration ? 0 : (slide.duration || 10) * 1000;

    if (dur > 0 && !pausedRef.current) {
      progress.setValue(0);
      Animated.timing(progress, { toValue: 1, duration: dur, useNativeDriver: false }).start();
      playTimer.current = setTimeout(() => {
        const next = idxRef.current + 1;
        if (next >= slidesRef.current.length && !settingsRef.current.loop) return;
        showSlide(next);
      }, dur);
    }
  }, []);

  function advanceSlide(dir) { showSlide(idxRef.current + dir); }

  // Start when slides load
  useEffect(() => {
    if (slides.length > 0 && phase === 'display') showSlide(0);
  }, [slides]);

  // Resume when unpaused
  useEffect(() => {
    if (!paused && slides.length > 0 && phase === 'display') showSlide(idx);
  }, [paused]);

  // HUD
  function showHud() {
    setHudVisible(true);
    clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHudVisible(false), 4000);
  }

  function exitDisplay() {
    clearTimeout(playTimer.current);
    clearInterval(pingTimer.current);
    wsRef.current?.close();
    setPhase('setup');
    setSlides([]);
    setIdx(0);
  }

  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  if (phase === 'setup') return <SetupScreen onConnect={onConnect} />;

  const currentSlide = slides[idx];

  return (
    <TouchableOpacity activeOpacity={1} style={s.display} onPress={showHud}>
      <StatusBar hidden />

      {/* Slides */}
      {slides.map((slide, i) =>
        i === idx ? <SlideRenderer key={slide.id || i} slide={slide} anim={opacity} /> : null
      )}

      {/* Empty state */}
      {!slides.length && (
        <View style={[s.slide, { backgroundColor: '#0a0806', alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color="#c4521a" size="large" />
          <Text style={{ color: 'rgba(245,240,232,0.4)', marginTop: 16, fontFamily: 'monospace', fontSize: 13 }}>
            Waiting for content…
          </Text>
        </View>
      )}

      {/* Overlays */}
      <OverlayClock settings={settings} />
      <Ticker settings={settings} />

      {/* Progress bar */}
      <Animated.View style={[s.progressBar, { width: progressWidth }]} />

      {/* Slide dots */}
      {slides.length > 1 && slides.length <= 20 && (
        <View style={s.dots}>
          {slides.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => showSlide(i)}>
              <View style={[s.dot, i === idx && s.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* HUD */}
      {hudVisible && (
        <View style={s.hud}>
          <View style={s.hudPill}>
            <View style={s.hudDot} />
            <Text style={s.hudTxt}>{connStatus}  ·  {idx + 1}/{slides.length}</Text>
          </View>
          <View style={s.hudRight}>
            <TouchableOpacity style={s.hudBtn} onPress={() => advanceSlide(-1)}><Text style={s.hudBtnTxt}>‹</Text></TouchableOpacity>
            <TouchableOpacity style={s.hudBtn} onPress={() => setPaused(p => !p)}><Text style={s.hudBtnTxt}>{paused ? '▶' : '⏸'}</Text></TouchableOpacity>
            <TouchableOpacity style={s.hudBtn} onPress={() => advanceSlide(1)}><Text style={s.hudBtnTxt}>›</Text></TouchableOpacity>
            <TouchableOpacity style={[s.hudBtn, { marginLeft: 8 }]} onPress={() => Alert.alert('Exit', 'Go back to setup?', [{ text: 'Cancel' }, { text: 'Exit', onPress: exitDisplay }])}><Text style={s.hudBtnTxt}>✕</Text></TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Setup
  setup: { flex:1, backgroundColor:'#0a0806', alignItems:'center', justifyContent:'center', padding:40 },
  setupLogo: { fontFamily:'serif', fontSize:SW > 600 ? 52 : 32, fontWeight:'900', color:'#f5f0e8', letterSpacing:-1 },
  setupSub: { fontFamily:'monospace', fontSize:11, color:'rgba(245,240,232,0.35)', letterSpacing:6, marginBottom:48, marginTop:6 },
  setupCard: { backgroundColor:'rgba(245,240,232,0.05)', borderWidth:1, borderColor:'rgba(245,240,232,0.12)', borderRadius:16, padding:36, width:'100%', maxWidth:460 },
  setupHint: { fontFamily:'monospace', fontSize:9, letterSpacing:6, color:'rgba(245,240,232,0.4)', marginBottom:8, textTransform:'uppercase' },
  setupInput: { backgroundColor:'rgba(245,240,232,0.08)', borderWidth:1.5, borderColor:'rgba(245,240,232,0.18)', borderRadius:10, color:'#f5f0e8', fontFamily:'monospace', fontSize:14, padding:14, marginBottom:4 },
  keyInput: { fontSize:28, letterSpacing:12, textAlign:'center', paddingVertical:18 },
  setupErr: { color:'#e8845a', fontFamily:'monospace', fontSize:12, marginTop:8, marginBottom:4 },
  setupBtn: { backgroundColor:'#c4521a', borderRadius:10, padding:16, alignItems:'center', marginTop:16 },
  setupBtnTxt: { color:'#fff', fontFamily:'serif', fontSize:18, fontWeight:'700' },
  setupNote: { fontFamily:'monospace', fontSize:10, color:'rgba(245,240,232,0.3)', textAlign:'center', marginTop:20, lineHeight:18 },

  // Display
  display: { flex:1, backgroundColor:'#000' },
  slide: { position:'absolute', top:0, left:0, right:0, bottom:0, alignItems:'center', justifyContent:'center' },
  slideHL: { fontSize:SW > 600 ? 72 : 36, fontWeight:'900', lineHeight:SW > 600 ? 80 : 42, letterSpacing:-1 },
  slideSub: { fontSize:SW > 600 ? 26 : 16, marginTop:16, lineHeight:SW > 600 ? 34 : 22 },

  // Caption
  caption: { position:'absolute', bottom:0, left:0, right:0, padding:30, paddingBottom:50, background:'transparent' },
  captionTxt: { color:'rgba(255,255,255,0.85)', fontSize:16, fontStyle:'italic' },

  // Clock slide
  clockSlide: { backgroundColor:'#0d1a2b', gap:16 },
  clockTime: { fontSize:SW > 600 ? 140 : 72, fontWeight:'900', color:'#f5f0e8', letterSpacing:-4, lineHeight:SW > 600 ? 150 : 80 },
  clockDate: { fontSize:SW > 600 ? 32 : 18, color:'rgba(245,240,232,0.5)', fontWeight:'300', letterSpacing:2 },
  weatherBlock: { flexDirection:'row', alignItems:'center', gap:24, backgroundColor:'rgba(255,255,255,0.06)', borderWidth:1, borderColor:'rgba(255,255,255,0.1)', borderRadius:20, padding:24, paddingHorizontal:40, marginTop:8 },
  weatherIcon: { fontSize:SW > 600 ? 64 : 40 },
  weatherTemp: { fontSize:SW > 600 ? 56 : 32, fontWeight:'900', color:'#f5f0e8' },
  weatherDesc: { fontSize:SW > 600 ? 20 : 13, color:'rgba(245,240,232,0.55)', marginTop:4 },
  weatherCity: { fontSize:12, color:'rgba(245,240,232,0.35)', letterSpacing:4, marginTop:6 },

  // Overlay clock
  overlayClock: { position:'absolute', bottom:32, right:24, alignItems:'flex-end' },
  ovTime: { fontSize:SW > 600 ? 36 : 22, fontWeight:'900', color:'rgba(255,255,255,0.85)', textShadowColor:'rgba(0,0,0,0.7)', textShadowOffset:{width:0,height:2}, textShadowRadius:10 },
  ovDate: { fontSize:SW > 600 ? 14 : 10, color:'rgba(255,255,255,0.45)', textShadowColor:'rgba(0,0,0,0.6)', textShadowOffset:{width:0,height:1}, textShadowRadius:6, marginTop:2 },

  // Ticker
  ticker: { position:'absolute', bottom:0, left:0, right:0, backgroundColor:'rgba(0,0,0,0.7)', borderTopWidth:1, borderTopColor:'rgba(196,82,26,0.5)', padding:9, overflow:'hidden' },
  tickerTxt: { color:'rgba(245,240,232,0.75)', fontFamily:'monospace', fontSize:13, whiteSpace:'nowrap' },

  // Progress
  progressBar: { position:'absolute', bottom:0, left:0, height:3, backgroundColor:'#c4521a' },

  // Dots
  dots: { position:'absolute', bottom:20, alignSelf:'center', flexDirection:'row', gap:7 },
  dot: { width:7, height:7, borderRadius:4, backgroundColor:'rgba(255,255,255,0.25)' },
  dotActive: { backgroundColor:'rgba(255,255,255,0.85)', transform:[{ scale:1.3 }] },

  // HUD
  hud: { position:'absolute', top:0, left:0, right:0, padding:16, flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'rgba(0,0,0,0)', },
  hudPill: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'rgba(0,0,0,0.5)', paddingHorizontal:16, paddingVertical:8, borderRadius:30, borderWidth:1, borderColor:'rgba(255,255,255,0.12)' },
  hudDot: { width:6, height:6, borderRadius:3, backgroundColor:'#4ade80' },
  hudTxt: { color:'rgba(255,255,255,0.6)', fontFamily:'monospace', fontSize:11 },
  hudRight: { flexDirection:'row', gap:6 },
  hudBtn: { backgroundColor:'rgba(0,0,0,0.5)', width:36, height:36, borderRadius:18, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.15)' },
  hudBtnTxt: { color:'rgba(255,255,255,0.7)', fontSize:16 },
});
