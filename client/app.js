const {useState, useEffect} = React;

// toast helper
function showToast(message, type='success', timeout=3000){
  const wrapperId = '___toast_wrapper___';
  let wrapper = document.getElementById(wrapperId);
  if (!wrapper){
    wrapper = document.createElement('div');
    wrapper.id = wrapperId;
    wrapper.className = 'toast-wrapper';
    document.body.appendChild(wrapper);
  }
  const el = document.createElement('div');
  el.className = 'toast ' + (type==='error' ? 'error' : 'success');
  el.innerHTML = `<div class="emoji">${type==='error' ? '⚠️' : '✅'}</div><div style="flex:1">${message}</div>`;
  wrapper.appendChild(el);
  setTimeout(()=>{ el.style.transition = 'all 300ms ease'; el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; }, timeout - 300);
  setTimeout(()=> el.remove(), timeout);
}

// global api helper
function api(path, method='GET', body=null, token=null){
  const headers = {'Content-Type':'application/json'};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch('/api' + path, {method, headers, body: body ? JSON.stringify(body) : undefined})
    .then(async res => {
      let json = {};
      try { json = await res.json(); } catch(e){ json = {}; }
      if (res.status === 401){
        localStorage.removeItem('token'); localStorage.removeItem('role'); localStorage.removeItem('name');
        showToast('Session expired. Please login again.', 'error');
        window.location.hash = 'login';
        return {ok:false, status:401, body: json};
      }
      return {ok: res.ok, status: res.status, body: json};
    }).catch(err => ({ok:false, body:{message:'Network error'}}));
}

function useAuth(){
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('role'));
  const [name, setName] = useState(localStorage.getItem('name'));
  function login(t, r, n){
    localStorage.setItem('token', t);
    localStorage.setItem('role', r);
    localStorage.setItem('name', n);
    setToken(t); setRole(r); setName(n);
  }
  function logout(){
    localStorage.removeItem('token'); localStorage.removeItem('role'); localStorage.removeItem('name');
    setToken(null); setRole(null); setName(null);
    window.location.hash = 'login';
  }
  return {token, role, name, login, logout};
}

function App(){
  const auth = useAuth();
  const [route, setRoute] = useState(window.location.hash.replace('#','') || (auth.token ? (auth.role==='Admin'?'admin':'student') : 'login'));

  useEffect(()=> {
    const onHash = ()=> setRoute(window.location.hash.replace('#','') || (auth.token ? (auth.role==='Admin'?'admin':'student') : 'login'));
    window.addEventListener('hashchange', onHash);
    return ()=> window.removeEventListener('hashchange', onHash);
  },[auth.token, auth.role]);

  useEffect(()=>{ if (auth.token) window.location.hash = (auth.role==='Admin') ? 'admin' : 'student'; }, [auth.token]);

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <div className="logo">MS</div>
          <div>
            <h1>MERN Intern Assignment</h1>
            <div className="small">Auth · Role-based Dashboards · SQLite</div>
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          {auth.name ? <div className="small-note">Signed in as <b>{auth.name}</b></div> : <div className="small-note">Not signed in</div>}
        </div>
      </div>

      {route === 'login' && <Login onLogin={auth.login} />}
      {route === 'signup' && <Signup />}
      {route === 'admin' && <AdminDashboard auth={auth} logout={auth.logout} />}
      {route === 'student' && <StudentDashboard auth={auth} logout={auth.logout} />}

      <div style={{marginTop:12}} className="center small-note">
        <div className="small-note">admin — email: <b>admin@example.com</b> / password: <b>admin123</b></div>
      </div>
    </div>
  );
}

function Login({onLogin}){
  const [email,setEmail]=useState(''), [password,setPassword]=useState(''), [err,setErr]=useState(''), [loading,setLoading]=useState(false);
  function submit(e){
    e.preventDefault(); setErr('');
    if (!email || !password){ setErr('Please fill both fields'); showToast('Please fill both fields', 'error'); return; }
    setLoading(true);
    api('/login','POST',{email,password}).then(res=>{
      setLoading(false);
      if (!res.ok){ setErr(res.body.message || 'Login failed'); showToast(res.body.message || 'Login failed', 'error'); }
      else { onLogin(res.body.token, res.body.role, res.body.name); showToast('Welcome back, ' + res.body.name); window.location.hash = (res.body.role==='Admin') ? 'admin':'student'; }
    });
  }
  return (
    <div className="grid">
      <div className="card">
        <h3>Login</h3>
        <form onSubmit={submit}>
          <div className="form-row"><label>Email</label><input placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} /></div>
          <div className="form-row"><label>Password</label><input type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} /></div>
          <div style={{display:'flex',gap:8}}>
            <button type="submit" className={loading? 'disabled': ''} disabled={loading}>{loading ? <span className="spinner"></span> : 'Login'}</button>
            <button type="button" className="btn-ghost" onClick={()=> window.location.hash='signup'}>Sign up</button>
          </div>
          {err && <div style={{marginTop:10}} className="notice error">{err}</div>}
        </form>
      </div>
      <div className="card"><h4>Quick Info</h4><div className="small">Use the seeded admin to view Admin Dashboard. Students can sign up or be added by admin.</div></div>
    </div>
  );
}

function Signup(){
  const [name,setName]=useState(''), [email,setEmail]=useState(''), [password,setPassword]=useState(''), [err,setErr]=useState(''), [loading,setLoading]=useState(false);
  function submit(e){
    e.preventDefault(); setErr('');
    if (!name || !email || !password){ setErr('All fields required'); showToast('All fields required', 'error'); return; }
    setLoading(true);
    api('/signup','POST',{name,email,password,'role':'Student'}).then(res=>{
      setLoading(false);
      if (!res.ok){ setErr(res.body.message || 'Failed'); showToast(res.body.message || 'Signup failed', 'error'); }
      else { showToast('Signup successful — you can login now'); window.location.hash='login'; }
    });
  }
  return (
    <div className="grid">
      <div className="card">
        <h3>Sign up (Student)</h3>
        <form onSubmit={submit}>
          <div className="form-row"><label>Name</label><input value={name} onChange={e=>setName(e.target.value)} /></div>
          <div className="form-row"><label>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} /></div>
          <div className="form-row"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} /></div>
          <div style={{display:'flex',gap:8}}>
            <button type="submit" className={loading? 'disabled': ''} disabled={loading}>{loading ? <span className="spinner"></span> : 'Create account'}</button>
            <button type="button" className="btn-ghost" onClick={()=> window.location.hash='login'}>Back to login</button>
          </div>
          {err && <div style={{marginTop:10}} className="notice error">{err}</div>}
        </form>
      </div>
      <div className="card"><h4>Why?</h4><div className="small">This demo uses JWT auth and role-based routes. Frontend is a lightweight React SPA using CDN to keep single-host setup.</div></div>
    </div>
  );
}

function AdminDashboard({auth, logout}){
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({name:'',email:'',course:'MERN Bootcamp',enrollmentDate:''});
  const [editId, setEditId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  useEffect(()=> { fetchList(); }, [page, limit]);

  function fetchList(){
    setLoading(true);
    api('/students?page='+page+'&limit='+limit,'GET',null,auth.token).then(res=>{
      setLoading(false);
      if (res.ok){ setStudents(res.body.students || []); setTotal(res.body.total || 0); }
      else { setStudents([]); showToast(res.body.message || 'Failed to fetch', 'error'); }
    });
  }

  function submit(e){
    e.preventDefault();
    if (!form.name || !form.email){ showToast('Name and email required', 'error'); return; }
    setIsSubmitting(true);
    if (editId){
      api('/students/'+editId,'PUT',form,auth.token).then(res=>{
        setIsSubmitting(false);
        if (!res.ok) showToast(res.body.message || 'Failed', 'error');
        else { showToast('Student updated'); setEditId(null); setForm({name:'',email:'',course:'MERN Bootcamp',enrollmentDate:''}); fetchList(); }
      });
    } else {
      api('/students','POST',form,auth.token).then(res=>{
        setIsSubmitting(false);
        if (!res.ok) showToast(res.body.message || 'Failed', 'error');
        else { showToast('Student created. Temp password: ' + (res.body.password || '—')); setForm({name:'',email:'',course:'MERN Bootcamp',enrollmentDate:''}); setPage(1); fetchList(); }
      });
    }
  }

  function edit(s){ setEditId(s.id); setForm({name:s.name,email:s.email,course:s.course,enrollmentDate:s.enrollmentDate}); window.scrollTo({top:0,behavior:'smooth'}); }
  function remove(id){ if (!confirm('Delete student?')) return; api('/students/'+id,'DELETE',null,auth.token).then(res=>{ if (res.ok) { showToast('Deleted'); fetchList(); } else showToast(res.body.message || 'Failed', 'error'); }); }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="grid" style={{gridTemplateColumns:'1fr 360px'}}>
      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h3>Admin Dashboard</h3><div className="logout-button-container"><button className="btn-ghost" onClick={()=>{logout(); showToast('Logged out');}}>Logout</button></div></div>
        <div style={{marginTop:10}} className="small">Manage students below</div>
        <div style={{marginTop:12}}>
          {loading ? <div className="center"><span className="spinner"></span></div> :
            <React.Fragment>
              {students.length === 0 ? <div className="small-note">No students yet</div> :
                <table className="table"><thead><tr><th>Name</th><th>Email</th><th>Course</th><th>Enrolled</th><th></th></tr></thead><tbody>
                  {students.map(s => (<tr key={s.id}><td>{s.name}</td><td>{s.email}</td><td>{s.course}</td><td>{s.enrollmentDate}</td><td className="actions"><button className="btn-ghost btn-mini" onClick={()=>edit(s)}>Edit</button><button className="btn-ghost btn-mini" onClick={()=>remove(s.id)}>Delete</button></td></tr>))}
                </tbody></table>}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12}}>
                <div className="small-note">Showing page {page} of {totalPages} — {total} total</div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <select value={limit} onChange={e=>{setLimit(parseInt(e.target.value)); setPage(1);}}>
                    <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option>
                  </select>
                  <button className="btn-ghost" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}>Prev</button>
                  <button className="btn-ghost" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages}>Next</button>
                </div>
              </div>
            </React.Fragment>
          }
        </div>
      </div>

      <div className="card">
        <h4>{editId ? 'Edit Student' : 'Add Student'}</h4>
        <form onSubmit={submit}>
          <div className="form-row"><label>Name</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
          <div className="form-row"><label>Email</label><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
          <div className="form-row"><label>Course</label><input value={form.course} onChange={e=>setForm({...form,course:e.target.value})} /></div>
          <div className="form-row"><label>Enrollment Date</label><input type="date" value={form.enrollmentDate} onChange={e=>setForm({...form,enrollmentDate:e.target.value})} /></div>
          <div style={{display:'flex',gap:8}}>
            <button type="submit" className={isSubmitting? 'disabled': ''} disabled={isSubmitting}>{isSubmitting ? <span className="spinner"></span> : (editId ? 'Save' : 'Create')}</button>
            {editId && <button type="button" className="btn-ghost" onClick={()=>{setEditId(null); setForm({name:'',email:'',course:'MERN Bootcamp',enrollmentDate:''});}}>Cancel</button>}
          </div>
        </form>
      </div>
    </div>
  );
}

function StudentDashboard({auth, logout}) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name:'', email:'', course:'' });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api('/students/me', 'GET', null, auth.token).then(res => {
      setLoading(false);
      if (res.ok) {
        setProfile(res.body);
        setForm({ name: res.body.name, email: res.body.email, course: res.body.course });
      } else {
        showToast(res.body.message || 'Failed to load profile', 'error');
      }
    });
  }, []);

  function submit(e) {
    e.preventDefault();
    if (!form.name || !form.email) {
      showToast('Name and email required', 'error');
      return;
    }
    setIsSaving(true);
    api('/students/me', 'PUT', form, auth.token).then(res => {
      setIsSaving(false);
      if (res.ok) {
        showToast('Profile updated');
        setProfile({ ...profile, ...form });
        localStorage.setItem('name', form.name);
      } else {
        showToast(res.body.message || 'Failed to update', 'error');
      }
    });
  }

  if (loading) {
    return (
      <div className="card">
        <h3>Student Dashboard</h3>
        <div className="center"><span className="spinner"></span></div>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      
      {/* Profile card */}
      <div className="card student-profile">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h3>Student Dashboard</h3>
          <div className="logout-button-container">
            <button className="btn-ghost" onClick={() => { logout(); showToast('Logged out'); }}>
              Logout
            </button>
          </div>
        </div>
        <h4 style={{ marginTop: 15 }}>Your Profile</h4>
        <div style={{ marginTop: 12, display:'grid', gap: 10, textAlign:'left' }}>
          <div><b>Name:</b> {profile.name}</div>
          <div><b>Email:</b> {profile.email}</div>
          <div><b>Course:</b> {profile.course}</div>
          <div><b>Enrollment:</b> {profile.enrollmentDate}</div>
        </div>
      </div>

      {/* Edit profile card */}
      <div className="card edit-profile">
        <h4>Edit Profile</h4>
        <form onSubmit={submit} style={{ display:'grid', gap:12 }}>
          <div className="form-row">
            <label htmlFor="p-name">Name</label>
            <input id="p-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="p-email">Email</label>
            <input id="p-email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="p-course">Course</label>
            <input id="p-course" value={form.course} onChange={e => setForm({ ...form, course: e.target.value })} />
          </div>
          <button type="submit" className={isSaving ? 'disabled' : ''} disabled={isSaving}>
            {isSaving ? <span className="spinner"></span> : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}


ReactDOM.createRoot(document.getElementById('root')).render(<App />);