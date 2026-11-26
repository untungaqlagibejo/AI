import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://127.0.0.1:7860'

function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [workerOnline, setWorkerOnline] = useState(false)
  const [jobs, setJobs] = useState([])
  const [image, setImage] = useState(null)
  const [audio, setAudio] = useState(null)
  const [video, setVideo] = useState(null)
  const [title, setTitle] = useState('')
  const [ratio, setRatio] = useState('16:9')

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  async function refreshJobs() {
    if (!session || !supabase) return
    const { data, error } = await supabase.from('generation_jobs')
      .select('*').order('created_at', { ascending: false }).limit(20)
    if (error) setMessage(error.message)
    else setJobs(data || [])
  }

  async function checkWorker() {
    try {
      const response = await fetch(`${WORKER_URL}/health`, { signal: AbortSignal.timeout(2500) })
      setWorkerOnline(response.ok)
    } catch { setWorkerOnline(false) }
  }

  useEffect(() => {
    if (!session) return
    refreshJobs()
    checkWorker()
    const timer = window.setInterval(checkWorker, 10000)
    return () => window.clearInterval(timer)
  }, [session])

  async function handleAuth(event) {
    event.preventDefault()
    setBusy(true); setMessage('')
    try {
      const result = authMode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
      if (result.error) throw result.error
      if (authMode === 'signup' && !result.data.session) {
        setMessage('Pendaftaran berhasil. Periksa email untuk konfirmasi akun.')
      }
    } catch (error) { setMessage(error.message || 'Gagal masuk.') }
    finally { setBusy(false) }
  }

  async function signOut() {
    await supabase?.auth.signOut()
    setJobs([])
  }

  async function createJob(event) {
    event.preventDefault()
    if (!session || !image || !audio) {
      setMessage('Pilih foto karakter dan file lagu terlebih dahulu.')
      return
    }
    if (!workerOnline) {
      setMessage('InfiniteTalk Worker belum aktif di komputer. Nyalakan worker terlebih dahulu.')
      return
    }
    setBusy(true); setMessage('')
    try {
      const form = new FormData()
      form.append('image', image)
      form.append('audio', audio)
      if (video) form.append('reference_video', video)
      form.append('title', title || audio.name.replace(/\.[^.]+$/, ''))
      form.append('aspect_ratio', ratio)
      const response = await fetch(`${WORKER_URL}/api/jobs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.detail || payload.error || 'Worker gagal menerima pekerjaan.')
      const { error } = await supabase.from('generation_jobs').insert({
        user_id: session.user.id,
        title: title || audio.name,
        audio_filename: audio.name,
        source_image_filename: image.name,
        reference_video_filename: video?.name || null,
        status: 'queued',
        aspect_ratio: ratio,
        worker_job_id: payload.job_id || null
      })
      if (error) throw error
      setMessage('Pekerjaan dikirim ke komputer. Proses AI berjalan di PC kamu.')
      setImage(null); setAudio(null); setVideo(null); setTitle('')
      await refreshJobs()
    } catch (error) { setMessage(error.message || 'Tidak dapat mengirim pekerjaan.') }
    finally { setBusy(false) }
  }

  if (!authReady) return <main className="center"><div className="loader" />Memuat InfiniteTalk Studio…</main>

  if (!isSupabaseConfigured) return (
    <main className="center"><section className="auth-card">
      <div className="brand-mark">IT</div><p className="eyebrow">PENGATURAN AWAL</p>
      <h1>Hubungkan Supabase</h1>
      <p className="muted">Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY pada Environment Variables Cloudflare Pages.</p>
    </section></main>
  )

  if (!session) return (
    <main className="center">
      <section className="auth-card">
        <div className="brand-mark">IT</div>
        <p className="eyebrow">LOCAL AI MUSIC STUDIO</p>
        <h1>InfiniteTalk <span>Studio</span></h1>
        <p className="muted">Buat video musik dengan sinkronisasi gerak mulut dari komputer sendiri.</p>
        <form onSubmit={handleAuth} className="stack">
          <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="nama@email.com" /></label>
          <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} placeholder="Minimal 6 karakter" /></label>
          <button className="primary" disabled={busy}>{busy ? 'Tunggu…' : authMode === 'login' ? 'Masuk' : 'Buat akun'}</button>
        </form>
        <button className="text-button" onClick={()=>setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
          {authMode === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
        </button>
        {message && <p className="notice">{message}</p>}
      </section>
    </main>
  )

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark small">IT</div><div><b>InfiniteTalk Studio</b><small>LOCAL AI WORKSPACE</small></div></div>
        <div className="user-area"><span>{session.user.email}</span><button className="ghost" onClick={signOut}>Keluar</button></div>
      </header>
      <section className="welcome">
        <div><p className="eyebrow">MUSIC VIDEO CREATION</p><h1>Hidupkan karakter<br/><span>melalui musik.</span></h1><p className="muted">Upload karakter dan lagu. InfiniteTalk memproses gerakan di PC kamu.</p></div>
        <div className="worker-card"><span className={workerOnline ? 'pulse online' : 'pulse'} /> <div><b>{workerOnline ? 'PC Worker terhubung' : 'PC Worker offline'}</b><small>{workerOnline ? 'Siap menerima pekerjaan' : 'Jalankan worker di komputer'}</small></div><button className="icon-button" onClick={checkWorker}>↻</button></div>
      </section>
      <div className="layout">
        <section className="panel create-panel">
          <div className="panel-heading"><div><p className="eyebrow">PROYEK BARU</p><h2>Buat video lip-sync</h2></div><span className="step-tag">01 / INPUT</span></div>
          <form onSubmit={createJob} className="stack">
            <label>Nama proyek<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Contoh: Cinta di Balik Layar" /></label>
            <div className="upload-grid">
              <label className="upload-box"><span className="upload-icon">▧</span><b>Foto karakter *</b><small>{image ? image.name : 'PNG / JPG'}</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setImage(e.target.files?.[0] || null)} /></label>
              <label className="upload-box"><span className="upload-icon">♫</span><b>Lagu / audio *</b><small>{audio ? audio.name : 'MP3 / WAV / M4A'}</small><input type="file" accept="audio/*" onChange={e=>setAudio(e.target.files?.[0] || null)} /></label>
              <label className="upload-box optional"><span className="upload-icon">▶</span><b>Video referensi</b><small>{video ? video.name : 'Opsional · MP4 / MOV'}</small><input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={e=>setVideo(e.target.files?.[0] || null)} /></label>
            </div>
            <label>Rasio video<select value={ratio} onChange={e=>setRatio(e.target.value)}><option value="16:9">16:9 — YouTube</option><option value="9:16">9:16 — Shorts</option><option value="1:1">1:1 — Square</option></select></label>
            <button className="primary" disabled={busy || !workerOnline}>{busy ? 'Mengirim…' : '✦  Mulai proses di PC'}</button>
            {!workerOnline && <p className="hint">Tombol aktif setelah InfiniteTalk Worker berjalan di komputer kamu.</p>}
          </form>
          {message && <p className="notice">{message}</p>}
        </section>
        <aside className="panel info-panel">
          <p className="eyebrow">CARA KERJA</p><h2>AI berjalan lokal</h2>
          <ol className="steps"><li><b>Upload bahan</b><small>Foto karakter, lagu, dan video referensi opsional.</small></li><li><b>Proses di komputer</b><small>InfiniteTalk menggunakan GPU PC, bukan kredit website.</small></li><li><b>Simpan hasil</b><small>Video selesai tersedia di komputer.</small></li></ol>
          <div className="privacy-note">🔒 File media diproses di PC. Supabase menyimpan akun dan riwayat pekerjaan.</div>
        </aside>
      </div>
      <section className="panel history">
        <div className="panel-heading"><div><p className="eyebrow">AKTIVITAS</p><h2>Riwayat proses</h2></div><button className="ghost" onClick={refreshJobs}>Muat ulang</button></div>
        {jobs.length === 0 ? <div className="empty"><span>◷</span><b>Belum ada proses</b><small>Riwayat video kamu akan muncul di sini.</small></div> :
          <div className="job-list">{jobs.map(job=><div className="job-row" key={job.id}><div className="job-icon">♫</div><div className="job-name"><b>{job.title}</b><small>{new Date(job.created_at).toLocaleString('id-ID')} · {job.aspect_ratio}</small></div><span className={`status ${job.status}`}>{job.status}</span></div>)}</div>}
      </section>
      <footer>INFINITETALK STUDIO AI <span>Local-first · Powered by InfiniteTalk</span></footer>
    </main>
  )
}

export default App
