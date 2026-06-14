/**
 * Vercel Serverless API - LEGACY / DEPRECATED
 *
 * Gunakan backend FastAPI Python (`backend/server.py`) sebagai backend utama.
 * File ini hanya dipertahankan untuk referensi dan migrasi bertahap.
 * Semua endpoint baru dan perbaikan hanya dilakukan di backend/server.py.
 */
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || '';
const DB_NAME = process.env.DB_NAME || 'eduscanner_ai';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

let dbPromise = null;
async function getDb() {
  if (!MONGO_URL) throw new Error('MONGO_URL not configured');
  if (!dbPromise) {
    const client = new MongoClient(MONGO_URL);
    dbPromise = client.connect().then(c => c.db(DB_NAME));
  }
  return dbPromise;
}

async function verifyToken(token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (res.status !== 200) throw new Error('Invalid token');
  return res.json();
}

async function getAuth(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const data = await verifyToken(auth.split(' ', 2)[1]);
    const authData = {
      userId: data.id || data.user_id || '',
      email: data.email || '',
      name: data.user_metadata?.full_name || data.user_metadata?.name || '',
      picture: data.user_metadata?.avatar_url,
    };
    try {
      const db = await getDb();
      if (authData.email) {
        const users = await db.collection('users').find({ email: authData.email }).sort({ onboarded: -1, created_at: 1 }).toArray();
        if (users.length > 0) {
          authData.userId = users[0].user_id;
        }
      }
    } catch (e) { console.error('Error resolving canonical user', e); }
    return authData;
  } catch {
    return null;
  }
}

function send(res, status, data) {
  res.status(status).json(data);
}

// Routes
const routes = {};

routes['GET /health'] = async (req, res) => {
  try { await getDb(); send(res, 200, { status: 'ok', mongo: 'connected' }); }
  catch { send(res, 200, { status: 'ok', mongo: 'disconnected', supabase: SUPABASE_URL ? 'ok' : 'missing' }); }
};

routes['POST /auth/session'] = async (req, res) => {
  try {
    if (!req.body || !req.body.access_token) {
      return send(res, 400, { detail: 'access_token required', bodyType: typeof req.body, bodyKeys: req.body ? Object.keys(req.body) : [] });
    }
    const data = await verifyToken(req.body.access_token);
    let userId = data.id || data.user_id || '';
    const email = data.email || '';
    const name = data.user_metadata?.full_name || data.user_metadata?.name || email.split('@')[0];
    const db = await getDb();
    if (email) {
      const users = await db.collection('users').find({ email }).sort({ onboarded: -1, created_at: 1 }).toArray();
      if (users.length > 0) {
        userId = users[0].user_id;
      }
    }
    let user = await db.collection('users').findOne({ user_id: userId });
    if (!user) {
      const base = (name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'user';
      let code = `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
      user = { user_id: userId, email, name, friend_code: code, onboarded: false, subjects: [], schedule: [], teaching_methods: [] };
      await db.collection('users').insertOne(user);
    }
    send(res, 200, user);
  } catch (e) { send(res, 401, { detail: e.message }); }
};

routes['GET /auth/me'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    // Try by Supabase UUID first, then by email (Python backend uses custom user_id)
    let user = await db.collection('users').findOne({ user_id: auth.userId });
    if (!user && auth.email) {
      user = await db.collection('users').findOne({ email: auth.email });
    }
    // Always return a proper object with onboarded field
    send(res, 200, user || { ...auth, onboarded: false });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['POST /auth/logout'] = async (req, res) => send(res, 200, { status: 'ok' });

routes['GET /auth/roles'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    let user = await db.collection('users').findOne({ user_id: auth.userId });
    if (!user && auth.email) {
      user = await db.collection('users').findOne({ email: auth.email });
    }
    if (!user) {
      return send(res, 200, { roles: [] });
    }

    const roles_list = [];

    // Pelajar role only if user is a student or has student data
    if (user.role === 'pelajar' || user.enrolled_class) {
      roles_list.push({
        role_type: 'pelajar',
        scope_id: null,
        status: 'active'
      });
    }

    if (user.institution_code) {
      const titles = new Set();
      if (user.title) titles.add(user.title);
      if (Array.isArray(user.titles)) {
        user.titles.forEach(t => titles.add(t));
      }
      for (const t_val of titles) {
        if (!roles_list.some(r => r.role_type === t_val)) {
          let scope_id = null;
          if (t_val === 'guru_kelas') {
            scope_id = user.assigned_class || null;
          } else if (t_val === 'guru_pengajar') {
            scope_id = user.assigned_subject || null;
          }
          
          roles_list.push({
            role_type: t_val,
            scope_id: scope_id,
            status: 'active'
          });
        }
      }

      // Check for additional active role assignments in DB
      const assignments = await db.collection('role_assignments').find({
        user_id: user.user_id,
        status: 'active'
      }).toArray();

      for (const a of assignments) {
        if (!roles_list.some(r => r.role_type === a.role_type)) {
          roles_list.push({
            role_type: a.role_type,
            scope_id: a.scope_id || null,
            status: 'active'
          });
        }
      }

      // Ensure owner has kepala_sekolah
      if (user.institution_owner && !roles_list.some(r => r.role_type === 'kepala_sekolah')) {
        roles_list.push({
          role_type: 'kepala_sekolah',
          scope_id: null,
          status: 'active'
        });
      }
    }

    send(res, 200, { roles: roles_list });
  } catch (e) {
    send(res, 500, { detail: e.message });
  }
};

routes['POST /auth/switch-role'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const { role_type } = req.body || {};
    if (!role_type) {
      return send(res, 400, { detail: 'role_type required' });
    }

    const db = await getDb();
    let user = await db.collection('users').findOne({ user_id: auth.userId });
    if (!user && auth.email) {
      user = await db.collection('users').findOne({ email: auth.email });
    }
    if (!user) {
      return send(res, 404, { detail: 'User tidak ditemukan' });
    }

    let is_valid_role = false;
    let scope_id = null;
    let target_role = 'pengajar'; // Default target role

    if (role_type === 'pelajar' && (user.role === 'pelajar' || user.enrolled_class)) {
      is_valid_role = true;
      target_role = 'pelajar';
    } else {
      // Check allowed roles from role_assignments
      const assignment = await db.collection('role_assignments').findOne({
        user_id: user.user_id,
        role_type: role_type,
        status: 'active'
      });

      if (assignment) {
        is_valid_role = true;
        scope_id = assignment.scope_id || null;
      } else if (role_type === 'kepala_sekolah' && user.institution_owner) {
        is_valid_role = true;
      } else {
        const titles = new Set();
        if (user.title) titles.add(user.title);
        if (Array.isArray(user.titles)) {
          user.titles.forEach(t => titles.add(t));
        }
        if (titles.has(role_type)) {
          is_valid_role = true;
          if (role_type === 'guru_kelas') {
            scope_id = user.assigned_class || null;
          } else if (role_type === 'guru_pengajar') {
            scope_id = user.assigned_subject || null;
          }
        }
      }
    }

    if (!is_valid_role) {
      return send(res, 403, { detail: 'Peran tidak terdaftar atau tidak aktif' });
    }

    const update_fields = {
      role: target_role,
      title: null,
      active_role: role_type,
      active_scope_id: scope_id
    };

    if (target_role !== 'pelajar') {
      update_fields.title = role_type;
      if (scope_id !== null) {
        if (role_type === 'guru_kelas') {
          update_fields.assigned_class = scope_id;
        } else if (role_type === 'guru_pengajar') {
          update_fields.assigned_subject = scope_id;
        }
      }
    }

    await db.collection('users').updateOne(
      { user_id: user.user_id },
      { $set: update_fields }
    );

    // Fetch updated user doc
    const updated_user_doc = await db.collection('users').findOne({ user_id: user.user_id });
    if (updated_user_doc) {
      updated_user_doc.is_institution_linked = !!updated_user_doc.institution_code;
      updated_user_doc.is_class_linked = !!(updated_user_doc.enrolled_class || updated_user_doc.class_token_used);
    }

    send(res, 200, {
      ok: true,
      active_role: role_type,
      user: updated_user_doc
    });
  } catch (e) {
    send(res, 500, { detail: e.message });
  }
};


routes['PUT /profile'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const { education_level, major, institution, current_semester, clone_voice_enabled, clone_voice_url } = req.body;
    const update = { 
      education_level, 
      major: major || null, 
      institution, 
      current_semester: parseInt(current_semester), 
      onboarded: true 
    };
    if (clone_voice_enabled !== undefined) update.clone_voice_enabled = !!clone_voice_enabled;
    if (clone_voice_url !== undefined) update.clone_voice_url = clone_voice_url;
    
    // Find by UUID or email (Python backend uses custom user_id)
    let user = await db.collection('users').findOne({ user_id: auth.userId });
    if (!user && auth.email) user = await db.collection('users').findOne({ email: auth.email });
    const filter = user ? { user_id: user.user_id } : { user_id: auth.userId };
    await db.collection('users').updateOne(filter, { $set: update }, { upsert: true });
    const updated = await db.collection('users').findOne(filter);
    send(res, 200, updated);
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['PUT /profile/friend-code'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const code = (req.body.friend_code || '').trim();
    if (!code || code.length < 3) return send(res, 400, { detail: 'Minimal 3 karakter' });
    if (!/^[a-z0-9_]+$/.test(code)) return send(res, 400, { detail: 'Hanya huruf/angka/underscore' });
    const db = await getDb();
    const dup = await db.collection('users').findOne({ friend_code: code, user_id: { $ne: auth.userId } });
    if (dup) return send(res, 409, { detail: 'Sudah digunakan' });
    await db.collection('users').updateOne({ user_id: auth.userId }, { $set: { friend_code: code } });
    send(res, 200, { friend_code: code });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['PUT /profile/teaching-methods'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    await db.collection('users').updateOne({ user_id: auth.userId }, { $set: { teaching_methods: req.body.teaching_methods || [] } });
    const updated = await db.collection('users').findOne({ user_id: auth.userId });
    send(res, 200, updated);
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['PUT /user/education'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    await db.collection('users').updateOne({ user_id: auth.userId }, { $set: { ...req.body, onboarded: true } }, { upsert: true });
    send(res, 200, await db.collection('users').findOne({ user_id: auth.userId }));
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /user/education'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const u = await db.collection('users').findOne({ user_id: auth.userId });
    if (!u) return send(res, 200, { education_level: null, major: null, institution: null });
    send(res, 200, { education_level: u.education_level, major: u.major, institution: u.institution, current_semester: u.current_semester, subjects: u.subjects || [], schedule: u.schedule || [] });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /users/search'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const q = req.query.q || '';
    const db = await getDb();
    const results = await db.collection('users').find({
      $or: [{ name: { $regex: q, $options: 'i' } }, { friend_code: { $regex: `^${q}$`, $options: 'i' } }],
      user_id: { $ne: auth.userId },
    }, { projection: { user_id: 1, name: 1, email: 1, friend_code: 1, education_level: 1, institution: 1 } }).limit(20).toArray();
    send(res, 200, { users: results });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['POST /friends/request'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const tid = req.body.target_user_id;
    if (!tid) return send(res, 400, { detail: 'target_user_id required' });
    const db = await getDb();
    const ex = await db.collection('friend_requests').findOne({ from_user_id: auth.userId, to_user_id: tid, status: 'pending' });
    if (ex) return send(res, 200, { status: 'already_sent' });
    const freqId = 'req_' + Math.random().toString(36).substr(2, 9);
    await db.collection('friend_requests').insertOne({ friend_request_id: freqId, from_user_id: auth.userId, to_user_id: tid, status: 'pending', created_at: new Date().toISOString() });
    send(res, 200, { status: 'sent' });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /friends/requests'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const requests = await db.collection('friend_requests').find({ to_user_id: auth.userId, status: 'pending' }).toArray();
    for (let r of requests) {
      if (!r.from_user_name) {
        const u = await db.collection('users').findOne({ user_id: r.from_user_id });
        if (u) r.from_user_name = u.name;
      }
    }
    send(res, 200, { requests });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['POST /friends/requests/:id/accept'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    let filter = { to_user_id: auth.userId };
    try {
      filter.$or = [{ friend_request_id: req.params.id }, { _id: new ObjectId(req.params.id) }];
    } catch {
      filter.friend_request_id = req.params.id;
    }
    await db.collection('friend_requests').updateOne(filter, { $set: { status: 'accepted' } });
    send(res, 200, { status: 'accepted' });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['POST /friends/requests/:id/reject'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    let filter = { to_user_id: auth.userId };
    try {
      filter.$or = [{ friend_request_id: req.params.id }, { _id: new ObjectId(req.params.id) }];
    } catch {
      filter.friend_request_id = req.params.id;
    }
    await db.collection('friend_requests').updateOne(filter, { $set: { status: 'rejected' } });
    send(res, 200, { status: 'rejected' });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /friends'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const accepted = await db.collection('friend_requests').find({
      $or: [
        { from_user_id: auth.userId, status: 'accepted' },
        { to_user_id: auth.userId, status: 'accepted' }
      ]
    }).toArray();
    
    const friendIds = new Set();
    for (const fr of accepted) {
      friendIds.add(fr.from_user_id === auth.userId ? fr.to_user_id : fr.from_user_id);
    }
    
    const friends = [];
    if (friendIds.size > 0) {
      const users = await db.collection('users').find({ user_id: { $in: Array.from(friendIds) } }).toArray();
      for (const u of users) {
        friends.push({
          user_id: u.user_id,
          name: u.name,
          picture: u.picture,
          education_level: u.education_level,
          institution: u.institution,
          friend_code: u.friend_code
        });
      }
    }
    send(res, 200, { friends });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /notifications'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    send(res, 200, await db.collection('notifications').find({ user_id: auth.userId }).sort({ created_at: -1 }).limit(50).toArray());
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /notifications/unread-count'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    send(res, 200, { count: await db.collection('notifications').countDocuments({ user_id: auth.userId, read: false }) });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['POST /notifications/:id/read'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    let filter = { user_id: auth.userId };
    try {
      filter.$or = [{ notification_id: req.params.id }, { _id: new ObjectId(req.params.id) }];
    } catch {
      filter.notification_id = req.params.id;
    }
    await db.collection('notifications').updateOne(filter, { $set: { read: true } });
    send(res, 200, { status: 'ok' });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['POST /notifications/read-all'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    await db.collection('notifications').updateMany({ user_id: auth.userId, read: false }, { $set: { read: true } });
    send(res, 200, { status: 'ok' });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /documents'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    send(res, 200, await db.collection('documents').find({ user_id: auth.userId }).sort({ created_at: -1 }).limit(100).toArray());
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /documents/:id'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const doc = await db.collection('documents').findOne({ document_id: req.params.id, user_id: auth.userId });
    if (!doc) return send(res, 404, { detail: 'Not found' });
    send(res, 200, doc);
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /audio/:filename'] = async (req, res) => {
  try {
    const db = await getDb();
    const audio = await db.collection('audio_files').findOne({ filename: req.params.filename });
    if (!audio) return send(res, 404, { detail: 'Audio not found' });
    
    let buffer;
    if (Buffer.isBuffer(audio.data)) {
      buffer = audio.data;
    } else if (audio.data && audio.data.buffer) {
      buffer = Buffer.from(audio.data.buffer);
    } else if (audio.data && typeof audio.data.value === 'function') {
      buffer = audio.data.value();
    } else if (audio.data) {
      buffer = Buffer.from(audio.data);
    } else {
      return send(res, 400, { detail: 'Invalid audio data' });
    }
    
    
    const isMp3 = buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33; // 'ID3'
    const isMp3NoId3 = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0; // MP3 syncword
    if (isMp3 || isMp3NoId3) {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else {
      res.setHeader('Content-Type', 'audio/wav');
    }
    res.end(buffer);
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /documents/:id/pdf'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const pdf = await db.collection('pdf_files').findOne({ document_id: req.params.id, user_id: auth.userId });
    if (!pdf) return send(res, 404, { detail: 'PDF not found' });
    
    let buffer;
    if (Buffer.isBuffer(pdf.data)) {
      buffer = pdf.data;
    } else if (pdf.data && pdf.data.buffer) {
      buffer = Buffer.from(pdf.data.buffer);
    } else if (pdf.data && typeof pdf.data.value === 'function') {
      buffer = pdf.data.value();
    } else if (pdf.data) {
      buffer = Buffer.from(pdf.data);
    } else {
      return send(res, 400, { detail: 'Invalid PDF data' });
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.end(buffer);
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /documents/:id/latest-result'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const r = await db.collection('quiz_results').findOne({ document_id: req.params.id, user_id: auth.userId }, { sort: { created_at: -1 } });
    send(res, 200, r || { status: 'none' });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

function parseMultipart(bodyBuffer, boundary) {
  const parts = [];
  const boundaryBuffer = Buffer.from('--' + boundary);
  let index = bodyBuffer.indexOf(boundaryBuffer);
  
  while (index !== -1) {
    const nextIndex = bodyBuffer.indexOf(boundaryBuffer, index + boundaryBuffer.length);
    if (nextIndex === -1) break;
    
    const partBuffer = bodyBuffer.slice(index + boundaryBuffer.length + 2, nextIndex - 2);
    const headerEndIndex = partBuffer.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEndIndex !== -1) {
      const headersText = partBuffer.slice(0, headerEndIndex).toString('utf-8');
      const dataBuffer = partBuffer.slice(headerEndIndex + 4);
      
      const filenameMatch = headersText.match(/filename="([^"]+)"/i);
      const nameMatch = headersText.match(/name="([^"]+)"/i);
      const contentTypeMatch = headersText.match(/Content-Type:\s*([^\r\n]+)/i);
      
      parts.push({
        name: nameMatch ? nameMatch[1] : null,
        filename: filenameMatch ? filenameMatch[1] : null,
        contentType: contentTypeMatch ? contentTypeMatch[1] : null,
        data: dataBuffer
      });
    }
    index = nextIndex;
  }
  return parts;
}

async function callGeminiWithPDF(systemMessage, prompt, pdfBuffer) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY tidak dikonfigurasi');
  const modelName = process.env.GEMINI_ANALYSIS_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
    systemInstruction: {
      parts: [{ text: systemMessage }]
    },
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: pdfBuffer.toString('base64')
            }
          },
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini PDF API error: ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0]) {
    return result.candidates[0].content.parts[0].text;
  }
  throw new Error('Unexpected Gemini API response structure');
}

routes['POST /documents/upload'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });

  // Batasan Vercel Serverless Function: 4.5MB
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 4.5 * 1024 * 1024) {
    return send(res, 413, { 
      detail: 'File terlalu besar untuk Vercel (Maks 4.5MB). Silakan gunakan backend FastAPI atau kompres PDF Anda.' 
    });
  }

  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
  if (!boundaryMatch) return send(res, 400, { detail: 'Boundary tidak ditemukan' });
  const boundary = boundaryMatch[1];

  try {
    const bodyBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', err => reject(err));
    });

    const parts = parseMultipart(bodyBuffer, boundary);
    const filePart = parts.find(p => p.name === 'file');
    if (!filePart || !filePart.filename) {
      return send(res, 400, { detail: 'Berkas tidak ditemukan dalam upload' });
    }
    if (!filePart.filename.toLowerCase().endsWith('.pdf')) {
      return send(res, 400, { detail: 'Format tidak didukung. Hanya PDF yang diterima.' });
    }

    const docId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const db = await getDb();

    // Simpan data PDF biner ke MongoDB
    await db.collection('pdf_files').insertOne({
      document_id: docId,
      user_id: auth.userId,
      data: filePart.data,
      created_at: new Date().toISOString()
    });

    const user = await db.collection('users').findOne({ user_id: auth.userId });
    if (!user) return send(res, 404, { detail: 'User tidak ditemukan' });

    const audience = getAudience(user);
    const system = `Kamu adalah EduScanner AI, asisten akademik elit untuk ${audience}. Tugasmu melakukan 'Deep Technical Extraction'. Jangan berikan rangkuman umum yang dangkal atau pendek. Tulis penjelasan yang sangat komprehensif, akademis, mendalam, dan padat fakta. Bahasa Indonesia.`;
    const analyzePrompt = `Analisis berkas PDF/gambar ini dengan kedalaman tingkat tinggi. Ekstrak informasi secara lengkap dan buat penjelasan yang sangat detail dalam struktur JSON berikut:
{
  "title": "judul dokumen akademik yang paling tepat dan representatif",
  "summary": "Rangkuman komprehensif dengan densitas tinggi (minimal 4-6 paragraf panjang, total minimal 400-600 kata). Uraikan secara mendalam: 1. Latar belakang & masalah utama yang dibahas, 2. Metodologi, konsep teoritis, atau logika detail yang digunakan, 3. Temuan, data statistik, atau analisis spesifik, 4. Kesimpulan penting dan implikasinya.",
  "key_concepts": [
    {
      "concept": "nama konsep/teori/istilah kunci",
      "explanation": "Penjelasan sangat detail dan mendalam (minimal 4-6 kalimat panjang per konsep). Uraikan definisi, cara kerja, contoh konkret, rumus matematika jika ada, atau logika internalnya secara lengkap.",
      "code_example": "contoh implementasi kode/skrip jika materi berkaitan dengan pemrograman/teknis, jika tidak biarkan kosong"
    }
  ],
  "diagrams": [
    {
      "name": "nama alur/proses/diagram",
      "type": "flowchart|diagram|chart|graph",
      "explanation": "Penjelasan langkah-demi-langkah (step-by-step) yang sangat mendalam mengenai alur data atau proses tersebut"
    }
  ],
  "learning_objectives": [
    "Mampu menganalisis X...",
    "Mampu mengimplementasi Y...",
    "tulis minimal 5 objektif pembelajaran spesifik"
  ]
}

Kewajiban Mutlak:
- Semua angka, data kuantitatif, rumus, dan terminologi ilmiah WAJIB diekstrak secara utuh.
- Hasilkan minimal 7 hingga 12 'key_concepts' dengan penjelasan yang sangat kaya dan panjang. Jangan diringkas pendek-pendek.
- Hindari kalimat pembuka seperti 'Dokumen ini membahas...'. Langsung ke substansi teknis.`;

    const documentDoc = {
      document_id: docId,
      user_id: auth.userId,
      filename: filePart.filename,
      file_path: `uploads/${docId}.pdf`,
      title: filePart.filename,
      summary: '',
      key_concepts: [],
      diagrams: [],
      learning_objectives: [],
      status: 'processing',
      created_at: new Date().toISOString()
    };

    await db.collection('documents').insertOne(documentDoc);
    send(res, 200, documentDoc);

    // BACKGROUND ANALYSIS
    (async () => {
      try {
        await new Promise(r => setTimeout(r, 2000));
        const geminiResp = await callGeminiWithPDF(system, analyzePrompt, filePart.data);
        const parsed = parseJsonBlock(geminiResp);
        if (parsed) {
          await db.collection('documents').updateOne(
            { document_id: docId },
            {
              $set: {
                title: parsed.title || filePart.filename,
                summary: parsed.summary || '',
                key_concepts: parsed.key_concepts || [],
                diagrams: parsed.diagrams || [],
                learning_objectives: parsed.learning_objectives || [],
                status: 'ready'
              }
            }
          );
        }
      } catch (geminiErr) {
        console.error(`Gemini PDF analysis failed for ${docId}:`, geminiErr);
        await db.collection('documents').updateOne(
          { document_id: docId },
          { $set: { status: 'failed', error: geminiErr.message } }
        );
      }
    })();
  } catch (e) {
    console.error("Upload handler failed:", e);
    send(res, 500, { detail: e.message || 'Gagal memproses berkas' });
  }
};

routes['POST /documents/upload-subject-material/:subject_id'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });

  const subjectId = req.params.subject_id;
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
  if (!boundaryMatch) return send(res, 400, { detail: 'Boundary tidak ditemukan' });
  const boundary = boundaryMatch[1];

  try {
    const db = await getDb();
    const user = await db.collection('users').findOne({ user_id: auth.userId });
    if (!user) return send(res, 404, { detail: 'User tidak ditemukan' });

    let subj = null;
    for (const s of (user.subjects || [])) {
      if (s.id === subjectId) {
        subj = s;
        break;
      }
    }
    if (!subj) return send(res, 404, { detail: 'Mapel tidak ditemukan di profil kamu' });

    const folderId = subj.folder_id;
    const subjectName = subj.name || '';

    const bodyBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', err => reject(err));
    });

    const parts = parseMultipart(bodyBuffer, boundary);
    const fileParts = parts.filter(p => p.name === 'files' || p.name === 'files[]' || p.name === 'file');
    if (fileParts.length === 0) {
      return send(res, 400, { detail: 'Pilih minimal 1 file' });
    }

    const audience = getAudience(user);
    const system = `Kamu adalah EduScanner AI, asisten akademik elit untuk ${audience}. Tugasmu melakukan 'Deep Technical Extraction'. Jangan berikan rangkuman umum yang dangkal atau pendek. Tulis penjelasan yang sangat komprehensif, akademis, mendalam, dan padat fakta. Bahasa Indonesia.`;
    const analyzePrompt = `Analisis berkas PDF/gambar ini dengan kedalaman tingkat tinggi. Ekstrak informasi secara lengkap dan buat penjelasan yang sangat detail dalam struktur JSON berikut:
{
  "title": "judul dokumen akademik yang paling tepat dan representatif",
  "summary": "Rangkuman komprehensif dengan densitas tinggi (minimal 4-6 paragraf panjang, total minimal 400-600 kata). Uraikan secara mendalam: 1. Latar belakang & masalah utama yang dibahas, 2. Metodologi, konsep teoritis, atau logika detail yang digunakan, 3. Temuan, data statistik, atau analisis spesifik, 4. Kesimpulan penting dan implikasinya.",
  "key_concepts": [
    {
      "concept": "nama konsep/teori/istilah kunci",
      "explanation": "Penjelasan sangat detail dan mendalam (minimal 4-6 kalimat panjang per konsep). Uraikan definisi, cara kerja, contoh konkret, rumus matematika jika ada, atau logika internalnya secara lengkap.",
      "code_example": "contoh implementasi kode/skrip jika materi berkaitan dengan pemrograman/teknis, jika tidak biarkan kosong"
    }
  ],
  "diagrams": [
    {
      "name": "nama alur/proses/diagram",
      "type": "flowchart|diagram|chart|graph",
      "explanation": "Penjelasan langkah-demi-langkah (step-by-step) yang sangat mendalam mengenai alur data atau proses tersebut"
    }
  ],
  "learning_objectives": [
    "Mampu menganalisis X...",
    "Mampu mengimplementasi Y...",
    "tulis minimal 5 objektif pembelajaran spesifik"
  ]
}

Kewajiban Mutlak:
- Semua angka, data kuantitatif, rumus, dan terminologi ilmiah WAJIB diekstrak secara utuh.
- Hasilkan minimal 7 hingga 12 'key_concepts' dengan penjelasan yang sangat kaya dan panjang. Jangan diringkas pendek-pendek.
- Hindari kalimat pembuka seperti 'Dokumen ini membahas...'. Langsung ke substansi teknis.`;

    const createdDocs = [];

    for (const filePart of fileParts) {
      if (!filePart.filename) continue;

      const filenameLower = filePart.filename.toLowerCase();
      const isPdf = filenameLower.endsWith('.pdf') || filePart.contentType === 'application/pdf';
      const isImage = filePart.contentType?.startsWith('image/') || /\.(jpe?g|png|webp|bmp)$/i.test(filenameLower);

      if (!isPdf && !isImage) {
        return send(res, 400, { detail: `Format ${filePart.filename} tidak didukung. Gunakan PDF atau gambar (JPG/PNG).` });
      }

      let pdfBytes = filePart.data;

      if (isImage) {
        try {
          const { PDFDocument } = require('pdf-lib');
          const pdfDoc = await PDFDocument.create();
          let embeddedImage;
          if (filePart.contentType === 'image/png' || filenameLower.endsWith('.png')) {
            embeddedImage = await pdfDoc.embedPng(filePart.data);
          } else {
            embeddedImage = await pdfDoc.embedJpg(filePart.data);
          }
          const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
          page.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: embeddedImage.width,
            height: embeddedImage.height,
          });
          const savedBytes = await pdfDoc.save();
          pdfBytes = Buffer.from(savedBytes);
        } catch (imgErr) {
          return send(res, 500, { detail: `Gagal konversi gambar ${filePart.filename} ke PDF: ${imgErr.message}` });
        }
      }

      const docId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      await db.collection('pdf_files').insertOne({
        document_id: docId,
        user_id: auth.userId,
        data: pdfBytes,
        created_at: new Date().toISOString()
      });

      let analysisResult = null;
      let status = 'ready';

      try {
        const geminiResp = await callGeminiWithPDF(system, analyzePrompt, pdfBytes);
        const parsed = parseJsonBlock(geminiResp);
        if (parsed) {
          analysisResult = {
            title: parsed.title || filePart.filename,
            summary: parsed.summary || '',
            key_concepts: parsed.key_concepts || [],
            diagrams: parsed.diagrams || [],
            learning_objectives: parsed.learning_objectives || []
          };
        } else {
          throw new Error('Format respons JSON dari Gemini tidak valid.');
        }
      } catch (geminiErr) {
        console.error(`Gemini PDF analysis failed for ${filePart.filename}:`, geminiErr);
        status = 'failed';
        analysisResult = {
          title: filePart.filename,
          summary: `Gagal menganalisis dokumen: ${geminiErr.message || geminiErr}`,
          key_concepts: [],
          diagrams: [],
          learning_objectives: []
        };
      }

      const documentDoc = {
        document_id: docId,
        user_id: auth.userId,
        filename: filePart.filename,
        file_path: `uploads/${docId}.pdf`,
        title: analysisResult.title,
        summary: analysisResult.summary,
        key_concepts: analysisResult.key_concepts,
        diagrams: analysisResult.diagrams,
        learning_objectives: analysisResult.learning_objectives,
        folder_id: folderId,
        subject_id: subjectId,
        subject_name: subjectName,
        status: status,
        created_at: new Date().toISOString()
      };

      await db.collection('documents').insertOne(documentDoc);
      createdDocs.push(documentDoc);
    }

    send(res, 200, createdDocs);
  } catch (e) {
    console.error("Upload subject material failed:", e);
    send(res, 500, { detail: e.message || 'Gagal memproses berkas' });
  }
};

routes['POST /documents/:id/cancel'] = async (req, res) => send(res, 501, { detail: 'Not available' });
routes['DELETE /documents/:id'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    await db.collection('documents').deleteOne({ document_id: req.params.id, user_id: auth.userId });
    await db.collection('pdf_files').deleteOne({ document_id: req.params.id, user_id: auth.userId });
    send(res, 200, { status: 'ok' });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /progress'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const docsCount = await db.collection('documents').countDocuments({ user_id: auth.userId, status: 'ready' });
    const quizzesCount = await db.collection('quizzes').countDocuments({ user_id: auth.userId });
    
    const results = await db.collection('quiz_results').find({ user_id: auth.userId }).toArray();
    let averageScore = 0;
    if (results.length > 0) {
      const sum = results.reduce((acc, r) => acc + (r.score || 0), 0);
      averageScore = Math.round((sum / results.length) * 10) / 10;
    }
    
    send(res, 200, {
      documents: docsCount,
      quizzes: quizzesCount,
      average_score: averageScore
    });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /folders'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const folders = await db.collection('folders').find({ user_id: auth.userId }).sort({ created_at: -1 }).limit(100).toArray();
    for (let f of folders) {
      f.document_count = await db.collection('documents').countDocuments({ user_id: auth.userId, folder_id: f.folder_id });
    }
    send(res, 200, folders);
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['POST /folders'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const fid = `FLD-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const folder = { folder_id: fid, user_id: auth.userId, name: req.body.name || 'Untitled', created_at: new Date().toISOString() };
    await db.collection('folders').insertOne(folder);
    send(res, 200, folder);
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /folders/:id'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const f = await db.collection('folders').findOne({ folder_id: req.params.id, user_id: auth.userId });
    if (!f) return send(res, 404, { detail: 'Not found' });
    
    // Attach documents inside this folder
    const docs = await db.collection('documents').find({ user_id: auth.userId, folder_id: req.params.id }).sort({ created_at: -1 }).toArray();
    f.documents = docs;
    
    // Attach recaps inside this folder
    const recaps = await db.collection('recaps').find({ user_id: auth.userId, folder_id: req.params.id }).sort({ created_at: -1 }).toArray();
    f.recaps = recaps;
    
    send(res, 200, f);
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['PUT /folders/:id'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    await db.collection('folders').updateOne({ folder_id: req.params.id, user_id: auth.userId }, { $set: { name: req.body.name } });
    send(res, 200, { status: 'ok' });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['DELETE /folders/:id'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    await db.collection('folders').deleteOne({ folder_id: req.params.id, user_id: auth.userId });
    send(res, 200, { status: 'ok' });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /folders/:id/latest-result'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const latest = await db.collection('quiz_results').findOne(
      { folder_id: req.params.id, user_id: auth.userId },
      { sort: { created_at: -1 } }
    );
    if (!latest) return send(res, 200, { status: 'none' });
    send(res, 200, latest);
  } catch (e) { send(res, 500, { detail: e.message }); }
};
routes['POST /documents/move'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const { document_ids, folder_id } = req.body;
    if (!document_ids || !Array.isArray(document_ids)) return send(res, 400, { detail: 'Invalid request' });
    await db.collection('documents').updateMany(
      { document_id: { $in: document_ids }, user_id: auth.userId },
      { $set: { folder_id: folder_id || null } }
    );
    send(res, 200, { status: 'moved' });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /quiz/results'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const results = await db.collection('quiz_results').find({ user_id: auth.userId }).sort({ created_at: -1 }).limit(100).toArray();
    const out = [];
    for (let r of results) {
      r.result_id = r.result_id || r._id.toString();
      const quizId = r.quiz_id;
      if (quizId) {
        const quiz = await db.collection('quizzes').findOne({ quiz_id: quizId });
        r.source_titles = quiz ? (quiz.source_titles || []) : [];
        r.folder_id = quiz ? quiz.folder_id : null;
      } else {
        r.source_titles = [];
        r.folder_id = null;
      }
      out.push(r);
    }
    send(res, 200, { results: out });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /quiz/result/:id'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    let filter = { user_id: auth.userId };
    try {
      filter.$or = [{ result_id: req.params.id }, { _id: new ObjectId(req.params.id) }];
    } catch {
      filter.result_id = req.params.id;
    }
    const r = await db.collection('quiz_results').findOne(filter);
    if (!r) return send(res, 404, { detail: 'Not found' });
    r.result_id = r.result_id || r._id.toString();
    send(res, 200, r);
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['POST /quiz/generate'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const payload = req.body;
    const documentId = payload.document_id;
    const documentIds = payload.document_ids || (documentId ? [documentId] : []);
    const folderId = payload.folder_id || null;
    const questionCount = payload.question_count || 5;

    let ids = [];
    if (documentIds && documentIds.length > 0) {
      ids = documentIds;
    } else if (folderId) {
      const folderDocs = await db.collection('documents').find({ user_id: auth.userId, folder_id: folderId, status: 'ready' }).toArray();
      ids = folderDocs.map(d => d.document_id);
    }
    if (ids.length === 0) return send(res, 400, { detail: 'Pilih minimal satu dokumen atau folder' });

    const documents = await db.collection('documents').find({ document_id: { $in: ids }, user_id: auth.userId }).toArray();
    if (documents.length === 0) return send(res, 404, { detail: 'Dokumen tidak ditemukan' });

    const user = await db.collection('users').findOne({ user_id: auth.userId });
    if (!user) return send(res, 404, { detail: 'User tidak ditemukan' });

    const quizId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    let recapText = '';
    if (payload.recap_id) {
      const recap = await db.collection('recaps').findOne({ recap_id: payload.recap_id, user_id: auth.userId });
      if (recap) {
        recapText = recap.unified_summary || '';
        if (!recapText && recap.per_document_summaries) {
          recapText = Object.values(recap.per_document_summaries).join('\n');
        }
      }
    }

    const quizDoc = {
      quiz_id: quizId,
      user_id: auth.userId,
      document_id: documents[0].document_id,
      document_ids: documents.map(d => d.document_id),
      source_titles: documents.map(d => d.title || d.filename),
      recap_id: payload.recap_id || null,
      folder_id: folderId,
      questions: [],
      status: 'processing',
      created_at: new Date().toISOString()
    };

    await db.collection('quizzes').insertOne(quizDoc);
    send(res, 200, quizDoc);

    // BACKGROUND GENERATION
    (async () => {
      try {
        const questions = await generateQuizQuestions(documents, user, questionCount, recapText);
        await db.collection('quizzes').updateOne(
          { quiz_id: quizId },
          { $set: { questions: questions, status: 'ready' } }
        );
      } catch (err) {
        console.error(`Quiz generation failed for ${quizId}:`, err);
        await db.collection('quizzes').updateOne(
          { quiz_id: quizId },
          { $set: { status: 'failed', error: err.message } }
        );
      }
    })();
  } catch (e) {
    send(res, 500, { detail: e.message });
  }
};

routes['POST /quiz/submit'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const payload = req.body;
    const quiz = await db.collection('quizzes').findOne({ quiz_id: payload.quiz_id, user_id: auth.userId });
    if (!quiz) return send(res, 404, { detail: 'Kuis tidak ditemukan' });

    const user = await db.collection('users').findOne({ user_id: auth.userId });
    if (!user) return send(res, 404, { detail: 'User tidak ditemukan' });

    const feedback = await generateDeepFeedback(quiz, payload.answers, user);

    const resultId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const resultDoc = {
      result_id: resultId,
      quiz_id: payload.quiz_id,
      document_id: quiz.document_id,
      user_id: auth.userId,
      answers: payload.answers,
      score: feedback.score,
      summary: feedback.summary,
      items: feedback.items,
      status: 'ready',
      created_at: new Date().toISOString()
    };

    await db.collection('quiz_results').insertOne(resultDoc);
    send(res, 200, resultDoc);
  } catch (e) {
    send(res, 500, { detail: e.message });
  }
};

routes['GET /quiz/:id'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const quiz = await db.collection('quizzes').findOne({ quiz_id: req.params.id, user_id: auth.userId });
    if (!quiz) return send(res, 404, { detail: 'Kuis tidak ditemukan' });
    send(res, 200, quiz);
  } catch (e) {
    send(res, 500, { detail: e.message });
  }
};

routes['POST /quiz/:id/cancel'] = async (req, res) => send(res, 200, { status: 'cancelled' });
routes['DELETE /quiz/:id'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    await db.collection('quizzes').deleteOne({ quiz_id: req.params.id, user_id: auth.userId });
    send(res, 200, { status: 'ok' });
  } catch (e) { send(res, 500, { detail: e.message }); }
};
routes['DELETE /quiz/result/:id'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    await db.collection('quiz_results').deleteOne({ result_id: req.params.id, user_id: auth.userId });
    send(res, 200, { status: 'ok' });
  } catch (e) { send(res, 500, { detail: e.message }); }
};
routes['POST /quiz/result/:id/cancel'] = async (req, res) => send(res, 501, { detail: 'Not available' });

routes['GET /documents/:id/messages'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const messages = await db.collection('discussion_messages').find({ document_id: req.params.id }).sort({ created_at: 1 }).limit(100).toArray();
    for (let m of messages) {
      const u = await db.collection('users').findOne({ user_id: m.user_id });
      if (u) {
        m.user_name = u.name;
        m.user_picture = u.picture;
      }
    }
    send(res, 200, messages);
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['POST /documents/:id/messages'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const mid = `MSG-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const msg = { message_id: mid, document_id: req.params.id, user_id: auth.userId, content: req.body.content || '', created_at: new Date().toISOString() };
    await db.collection('discussion_messages').insertOne(msg);
    const u = await db.collection('users').findOne({ user_id: auth.userId });
    if (u) {
      msg.user_name = u.name;
      msg.user_picture = u.picture;
    }
    send(res, 200, msg);
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /documents/:id/discussion/participants'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const doc = await db.collection('documents').findOne({ document_id: req.params.id });
    if (!doc) return send(res, 404, { detail: 'Document not found' });
    const participants = [];
    const owner = await db.collection('users').findOne({ user_id: doc.user_id });
    if (owner) {
      participants.push({
        user_id: owner.user_id,
        name: owner.name,
        picture: owner.picture,
        friend_code: owner.friend_code,
        role: 'owner'
      });
    }
    const members = await db.collection('discussion_participants').find({ document_id: req.params.id }).toArray();
    for (const m of members) {
      const u = await db.collection('users').findOne({ user_id: m.user_id });
      if (u) {
        participants.push({
          user_id: u.user_id,
          name: u.name,
          picture: u.picture,
          friend_code: u.friend_code,
          role: 'member'
        });
      }
    }
    send(res, 200, { participants });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['POST /documents/:id/discussion/invite'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const { target_user_id } = req.body;
    if (!target_user_id) return send(res, 400, { detail: 'target_user_id required' });
    
    const existing = await db.collection('discussion_participants').findOne({ document_id: req.params.id, user_id: target_user_id });
    if (existing) return send(res, 200, { status: 'already_invited' });
    
    await db.collection('discussion_participants').insertOne({
      document_id: req.params.id,
      user_id: target_user_id,
      created_at: new Date().toISOString()
    });
    
    const doc = await db.collection('documents').findOne({ document_id: req.params.id });
    const docTitle = doc ? (doc.title || doc.filename) : 'Modul';
    const inviter = await db.collection('users').findOne({ user_id: auth.userId });
    const inviterName = inviter ? inviter.name : 'Teman';
    
    await db.collection('notifications').insertOne({
      notification_id: 'notif_' + Math.random().toString(36).substr(2, 9),
      user_id: target_user_id,
      type: 'discussion_invite',
      message: `${inviterName} mengundang Anda ke diskusi kelompok: ${docTitle}`,
      data: { document_id: req.params.id },
      read: false,
      created_at: new Date().toISOString()
    });
    
    send(res, 200, { status: 'ok' });
  } catch (e) { send(res, 500, { detail: e.message }); }
};
routes['POST /documents/:id/discussion/leave'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    await db.collection('discussion_participants').deleteOne({ document_id: req.params.id, user_id: auth.userId });
    send(res, 200, { status: 'ok' });
  } catch (e) { send(res, 500, { detail: e.message }); }
};
routes['POST /documents/:id/discussion/kick'] = async (req, res) => send(res, 200, { status: 'ok' });
routes['POST /documents/:id/chat'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const doc = await db.collection('documents').findOne({ document_id: req.params.id, user_id: auth.userId });
    if (!doc) return send(res, 404, { detail: 'Dokumen tidak ditemukan' });
    if (doc.status !== 'ready') return send(res, 400, { detail: 'Dokumen belum siap dianalisis' });

    const user = await db.collection('users').findOne({ user_id: auth.userId });
    if (!user) return send(res, 404, { detail: 'User tidak ditemukan' });

    const audience = getAudience(user);
    const context = JSON.stringify({
      title: doc.title || '',
      summary: (doc.summary || '').substring(0, 2500),
      key_concepts: (doc.key_concepts || []).slice(0, 5).map(c => c.concept || ''),
      learning_objectives: (doc.learning_objectives || []).slice(0, 4)
    });

    const system = `Kamu EduScanner AI, asisten belajar untuk ${audience}. Jawab pertanyaan berdasarkan dokumen. Bahasa Indonesia.`;
    const prompt = `DOKUMEN:\n${context}\n\nPERTANYAAN: ${req.body.question}`;

    let answer;
    try {
      answer = await callGroq(system, prompt, false);
    } catch (e) {
      answer = await callGroq(system, `Materi: ${doc.title}. Tanya: ${req.body.question}`, false);
    }

    send(res, 200, { answer });
  } catch (e) {
    send(res, 500, { detail: e.message });
  }
};

routes['POST /quiz/result/:id/chat'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const r = await db.collection('quiz_results').findOne({ result_id: req.params.id, user_id: auth.userId });
    if (!r) return send(res, 404, { detail: 'Hasil tidak ditemukan' });
    if (r.status !== 'ready') return send(res, 400, { detail: 'Hasil belum siap' });

    const quiz = await db.collection('quizzes').findOne({ quiz_id: r.quiz_id });
    const user = await db.collection('users').findOne({ user_id: auth.userId });
    if (!user) return send(res, 404, { detail: 'User tidak ditemukan' });

    const audience = getAudience(user);
    const context = {
      score: r.score || 0,
      summary: r.summary || '',
      questions: []
    };

    if (quiz) {
      quiz.questions.forEach((q, i) => {
        const fb = r.items && i < r.items.length ? r.items[i] : null;
        const isCorrect = fb ? fb.is_correct : false;

        const qData = {
          question: q.question,
          is_correct: isCorrect,
          explanation: fb ? fb.explanation : ''
        };
        if (!isCorrect) {
          qData.options = q.options;
          qData.correct_index = q.correct_index;
          qData.user_answer_index = r.answers && i < r.answers.length ? r.answers[i] : -1;
        }
        context.questions.push(qData);
      });
    }

    const system = `Kamu adalah EduScanner AI, tutor akademik untuk ${audience}. Kamu membantu user memahami hasil kuis mereka. Bahasa Indonesia. Gunakan data kuis (detail hanya ada untuk soal salah) untuk menjawab.`;
    const prompt = `DATA KUIS:\n${JSON.stringify(context)}\n\nPERTANYAAN USER: ${req.body.question}`;

    const answer = await callGroq(system, prompt, false);
    send(res, 200, { answer });
  } catch (e) {
    send(res, 500, { detail: e.message });
  }
};

routes['GET /user/education/materials'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    send(res, 200, await db.collection('study_materials').find({ user_id: auth.userId }).sort({ created_at: -1 }).limit(100).toArray());
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /user/education/materials/:id'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const m = await db.collection('study_materials').findOne({ material_id: req.params.id, user_id: auth.userId });
    if (!m) return send(res, 404, { detail: 'Not found' });
    send(res, 200, m);
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['DELETE /user/education/materials/:id'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    await db.collection('study_materials').deleteOne({ material_id: req.params.id, user_id: auth.userId });
    send(res, 200, { status: 'ok' });
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['POST /user/education/generate'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const payload = req.body;
    if (!payload.subject_name || !payload.subject_name.trim()) {
      return send(res, 400, { detail: 'Nama mapel wajib' });
    }

    const userDoc = await db.collection('users').findOne({ user_id: auth.userId });
    if (!userDoc) return send(res, 404, { detail: 'User tidak ditemukan' });

    const level = userDoc.education_level || 'Umum';
    const grade = userDoc.current_semester || '';
    const major = userDoc.major || '';
    const institution = userDoc.institution || '';

    let subjData = null;
    for (const s of (userDoc.subjects || [])) {
      if (s.id === payload.subject_id) {
        subjData = s;
        break;
      }
    }
    if (!subjData) return send(res, 404, { detail: 'Mapel tidak ditemukan di profil kamu' });

    const folderId = subjData.folder_id;
    const topic = payload.topic || payload.subject_name;
    const audience = getAudience(userDoc);

    const system = `Kamu adalah asisten pembelajaran untuk ${audience}. Buat materi belajar tentang ${topic} untuk ${level}, kelas ${grade}` +
      (major ? `, jurusan ${major}` : '') + (institution ? `, ${institution}` : '') + `. Gunakan bahasa Indonesia. Format output sebagai JSON dengan keys: title (string), summary (string, 2-3 paragraf), key_concepts (array of {concept, explanation}), study_notes (string, penjelasan detail poin-poin penting), practice_questions (array of {question, options (array of 4), correct_index, explanation}).`;
    
    const prompt = `Buat materi belajar tentang ${topic} untuk ${level} kelas ${grade}` + (major ? ` jurusan ${major}` : '') + `. Topik ini adalah bagian dari mata pelajaran ${payload.subject_name}. Buat materi yang sesuai dengan kurikulum Indonesia. Sertakan ringkasan, konsep kunci, catatan belajar, dan 3 soal latihan.`;

    const resp = await callGroq(system, prompt, true);
    const data = parseJsonBlock(resp);

    const materialId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const title = data.title || `Materi ${topic}`;

    const material = {
      material_id: materialId,
      user_id: auth.userId,
      subject_id: payload.subject_id,
      subject_name: payload.subject_name,
      folder_id: folderId,
      topic: topic,
      title: title,
      summary: data.summary || '',
      key_concepts: data.key_concepts || [],
      study_notes: data.study_notes || '',
      practice_questions: data.practice_questions || [],
      created_at: new Date().toISOString()
    };

    await db.collection('study_materials').insertOne(material);

    await db.collection('documents').insertOne({
      document_id: materialId,
      user_id: auth.userId,
      filename: `Materi - ${title}.md`,
      file_path: `generated/${materialId}.md`,
      title: title,
      folder_id: folderId,
      subject_id: payload.subject_id,
      subject_name: payload.subject_name,
      ai_generated: true,
      ai_content: data,
      summary: data.summary || '',
      key_concepts: data.key_concepts || [],
      diagrams: [],
      learning_objectives: [],
      status: 'ready',
      created_at: new Date().toISOString()
    });

    send(res, 200, material);
  } catch (e) {
    send(res, 500, { detail: e.message });
  }
};

routes['POST /recap'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const payload = req.body;

    let ids = [];
    if (payload.document_ids && payload.document_ids.length > 0) {
      ids = payload.document_ids;
    } else if (payload.folder_id) {
      const folderDocs = await db.collection('documents').find({ user_id: auth.userId, folder_id: payload.folder_id, status: 'ready' }).toArray();
      ids = folderDocs.map(d => d.document_id);
    }
    if (ids.length === 0) return send(res, 400, { detail: 'Pilih minimal satu dokumen atau folder' });

    const documents = await db.collection('documents').find({ document_id: { $in: ids }, user_id: auth.userId }).toArray();
    if (documents.length === 0) return send(res, 404, { detail: 'Dokumen tidak ditemukan' });

    const user = await db.collection('users').findOne({ user_id: auth.userId });
    if (!user) return send(res, 404, { detail: 'User tidak ditemukan' });

    const recapId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const data = await generateRecap(documents, user);

    const recapDoc = {
      recap_id: recapId,
      user_id: auth.userId,
      document_ids: documents.map(d => d.document_id),
      source_titles: documents.map(d => d.title || d.filename),
      folder_id: payload.folder_id || null,
      title: data.title || 'Rangkuman Gabungan',
      unified_summary: data.unified_summary || '',
      per_document: data.per_document || [],
      shared_concepts: data.shared_concepts || [],
      study_path: data.study_path || [],
      status: 'ready',
      created_at: new Date().toISOString()
    };

    await db.collection('recaps').insertOne(recapDoc);

    if (payload.folder_id) {
      await db.collection('folders').updateOne(
        { folder_id: payload.folder_id },
        {
          $set: {
            recap_id: recapId,
            recap_title: data.title || '',
            recap_summary: data.unified_summary || '',
            recap_document_ids: recapDoc.document_ids,
            recap_generated_at: new Date().toISOString()
          }
        }
      );
    }

    send(res, 200, recapDoc);
  } catch (e) {
    send(res, 500, { detail: e.message });
  }
};
routes['GET /recap/:id'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const recap = await db.collection('recaps').findOne({ recap_id: req.params.id, user_id: auth.userId });
    if (!recap) return send(res, 404, { detail: 'Not found' });
    send(res, 200, recap);
  } catch (e) { send(res, 500, { detail: e.message }); }
};
routes['POST /recap/:id/cancel'] = async (req, res) => send(res, 501, { detail: 'Not available' });
routes['DELETE /recap/:id'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    await db.collection('recaps').deleteOne({ recap_id: req.params.id, user_id: auth.userId });
    send(res, 200, { status: 'deleted' });
  } catch (e) { send(res, 500, { detail: e.message }); }
};
routes['GET /recaps'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const recaps = await db.collection('recaps').find({ user_id: auth.userId }).sort({ created_at: -1 }).limit(100).toArray();
    send(res, 200, recaps);
  } catch (e) { send(res, 500, { detail: e.message }); }
};
function chunkText(text, maxChars = 120) {
  const words = text.split(/\s+/);
  const chunks = [];
  let currentChunk = "";

  for (const word of words) {
    const candidate = (currentChunk + " " + word).trim();
    if (candidate.length > maxChars) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = word;
    } else {
      currentChunk = candidate;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

function concatenateWavs(wavBuffers) {
  if (wavBuffers.length === 0) return null;
  if (wavBuffers.length === 1) return wavBuffers[0];

  const firstBuffer = wavBuffers[0];
  const pcmBuffers = wavBuffers.map(buf => buf.subarray(44));
  const totalPcmLength = pcmBuffers.reduce((acc, buf) => acc + buf.length, 0);
  
  const combinedBuffer = Buffer.alloc(44 + totalPcmLength);
  firstBuffer.copy(combinedBuffer, 0, 0, 44);
  combinedBuffer.writeUInt32LE(36 + totalPcmLength, 4);
  combinedBuffer.writeUInt32LE(totalPcmLength, 40);
  
  let offset = 44;
  for (const pcmBuf of pcmBuffers) {
    pcmBuf.copy(combinedBuffer, offset);
    offset += pcmBuf.length;
  }
  
  return combinedBuffer;
}

async function generateDefaultTTS(text) {
  const cleaned = text.replace(/[*#_~`^\\\[\]<>{}|@$%&+=/]/g, "").trim();
  if (!cleaned) throw new Error("Teks kosong setelah dibersihkan");

  const words = cleaned.split(/\s+/);
  const chunks = [];
  let currentChunk = "";
  for (const word of words) {
    const candidate = currentChunk ? `${currentChunk} ${word}` : word;
    if (candidate.length > 200) {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = word;
    } else {
      currentChunk = candidate;
    }
  }
  if (currentChunk) chunks.push(currentChunk);


  const buffers = [];
  for (let i = 0; i < chunks.length; i++) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&q=${encodeURIComponent(chunks[i])}`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!resp.ok) {
      throw new Error(`Google Translate TTS failed with status ${resp.status}`);
    }
    const arrayBuffer = await resp.arrayBuffer();
    buffers.push(Buffer.from(arrayBuffer));
  }

  return Buffer.concat(buffers);
}

async function generateCloneVoice(text, audioUrl) {
  const cleaned = text.replace(/[*#_~`^\\\[\]<>{}|@$%&+=/]/g, "").trim();
  if (!cleaned) throw new Error("Teks kosong setelah dibersihkan");

  const chunks = chunkText(cleaned, 120);

  const premiumVoiceUrl = audioUrl || "https://eduai-deploy.vercel.app/suara/cara-membedakan-voice-changer-atau-murni-ala-miti-mythia-batford-aesood.wav";

  async function generateSingleChunk(chunkTextStr, index) {
    const submitResp = await fetch("https://alstears-chatterbox-id-clone-api.hf.space/gradio_api/call/clone_voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [chunkTextStr, null, premiumVoiceUrl]
      })
    });
    if (!submitResp.ok) {
      throw new Error(`Failed to submit chunk: ${submitResp.statusText}`);
    }
    const submitResult = await submitResp.json();
    const eventId = submitResult.event_id;
    if (!eventId) {
      throw new Error(`Gradio did not return an event_id. Response: ${JSON.stringify(submitResult)}`);
    }

    const streamResp = await fetch(`https://alstears-chatterbox-id-clone-api.hf.space/gradio_api/call/clone_voice/${eventId}`);
    if (!streamResp.ok) {
      throw new Error(`Failed to connect to result stream: ${streamResp.statusText}`);
    }
    const streamText = await streamResp.text();

    const errorMatch = streamText.match(/event:\s*error\s*\r?\ndata:\s*([^\r\n]+)/);
    if (errorMatch) {
      try {
        const errObj = JSON.parse(errorMatch[1]);
        if (errObj && errObj.error) {
          throw new Error(errObj.error);
        }
      } catch (e) {
        if (e.message && !e.message.includes("JSON")) throw e;
      }
    }

    const matches = [...streamText.matchAll(/data:\s*([^\r\n]+)/g)];
    if (matches.length === 0) {
      throw new Error(`No data events received in Gradio stream: ${streamText}`);
    }

    for (let i = matches.length - 1; i >= 0; i--) {
      try {
        const dataStr = matches[i][1].trim();
        const parsed = JSON.parse(dataStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const audioInfo = parsed[0];
          let fileUrl = null;
          if (audioInfo && typeof audioInfo === 'object') {
            if (audioInfo.url) {
              fileUrl = audioInfo.url;
            } else if (audioInfo.path) {
              fileUrl = `https://alstears-chatterbox-id-clone-api.hf.space/gradio_api/file=${audioInfo.path}`;
            }
          } else if (typeof audioInfo === 'string') {
            fileUrl = audioInfo;
          }

          if (fileUrl) {
            if (fileUrl.startsWith("/")) {
              fileUrl = `https://alstears-chatterbox-id-clone-api.hf.space${fileUrl}`;
            } else if (!fileUrl.startsWith("http")) {
              fileUrl = `https://alstears-chatterbox-id-clone-api.hf.space/gradio_api/file=${fileUrl}`;
            }
            
            const audioResp = await fetch(fileUrl);
            if (!audioResp.ok) throw new Error(`Failed to download audio: ${audioResp.statusText}`);
            const arrayBuffer = await audioResp.arrayBuffer();
            return Buffer.from(arrayBuffer);
          }
        }
      } catch (e) {
        if (e.message && !e.message.includes("JSON")) throw e;
      }
    }

    throw new Error(`Could not find a valid audio result in event stream: ${streamText}`);
  }

  const promises = chunks.map(async (chunk, i) => {
    try {
      return await generateSingleChunk(chunk, i);
    } catch (e) {
      console.error(`Error generating chunk ${i + 1}/${chunks.length}:`, e);
      return null;
    }
  });
  const results = await Promise.all(promises);
  const audioBuffers = results.filter(buf => buf !== null);
  if (audioBuffers.length === 0) {
    throw new Error("Gagal menggenerasi seluruh chunk audio");
  }

  return concatenateWavs(audioBuffers);
}

routes['POST /recap/:id/tts'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const recapId = req.params.id;
    const filename = `recap_${recapId}.wav`;
    
    // Check if recap exists
    const recap = await db.collection('recaps').findOne({ recap_id: recapId, user_id: auth.userId });
    if (!recap) return send(res, 404, { detail: 'Recap tidak ditemukan' });

    const existing = await db.collection('audio_files').findOne({ filename });
    if (existing) {
      const audioUrl = `/api/audio/${filename}`;
      await db.collection('recaps').updateOne({ recap_id: recapId }, { $set: { audio_url: audioUrl } });
      return send(res, 200, { audio_url: audioUrl, status: 'ready' });
    }

    try {
      const text = (recap.unified_summary || "").trim();
      const user = await db.collection('users').findOne({ user_id: auth.userId });
      const useCloning = user ? (user.clone_voice_enabled !== false) : true;
      const voiceUrl = user ? user.clone_voice_url : null;
      
      const buffer = useCloning
        ? await generateCloneVoice(text, voiceUrl)
        : await generateDefaultTTS(text);

      await db.collection('audio_files').updateOne(
        { filename },
        { $set: { filename, data: buffer, created_at: new Date().toISOString() } },
        { upsert: true }
      );
      const audioUrl = `/api/audio/${filename}`;
      await db.collection('recaps').updateOne({ recap_id: recapId }, { $set: { audio_url: audioUrl } });
      return send(res, 200, { audio_url: audioUrl, status: 'ready' });
    } catch (err) {
      console.error("Failed to generate recap voice on Vercel:", err);
      return send(res, 500, { detail: "Gagal generate audio: " + err.message });
    }
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['POST /documents/:id/tts'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    const docId = req.params.id;
    const filename = `doc_${docId}.wav`;

    // Check if doc exists
    const doc = await db.collection('documents').findOne({ document_id: docId, user_id: auth.userId });
    if (!doc) return send(res, 404, { detail: 'Dokumen tidak ditemukan' });

    const existing = await db.collection('audio_files').findOne({ filename });
    if (existing) {
      const audioUrl = `/api/audio/${filename}`;
      await db.collection('documents').updateOne({ document_id: docId }, { $set: { audio_url: audioUrl } });
      return send(res, 200, { audio_url: audioUrl, status: 'ready' });
    }

    try {
      const text = (doc.summary || "").trim();
      const user = await db.collection('users').findOne({ user_id: auth.userId });
      const useCloning = user ? (user.clone_voice_enabled !== false) : true;
      const voiceUrl = user ? user.clone_voice_url : null;
      
      const buffer = useCloning
        ? await generateCloneVoice(text, voiceUrl)
        : await generateDefaultTTS(text);

      await db.collection('audio_files').updateOne(
        { filename },
        { $set: { filename, data: buffer, created_at: new Date().toISOString() } },
        { upsert: true }
      );
      const audioUrl = `/api/audio/${filename}`;
      await db.collection('documents').updateOne({ document_id: docId }, { $set: { audio_url: audioUrl } });
      return send(res, 200, { audio_url: audioUrl, status: 'ready' });
    } catch (err) {
      console.error("Failed to generate document voice on Vercel:", err);
      return send(res, 500, { detail: "Gagal generate audio: " + err.message });
    }
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /audit-logs'] = async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) return send(res, 401, { detail: 'Unauthorized' });
  try {
    const db = await getDb();
    send(res, 200, await db.collection('audit_logs').find({ user_id: auth.userId }).sort({ timestamp: -1 }).limit(100).toArray());
  } catch (e) { send(res, 500, { detail: e.message }); }
};

routes['GET /diag/gemini'] = async (req, res) => send(res, 200, {
  gemini: { ok: !!GEMINI_API_KEY },
  supabase: { ok: !!SUPABASE_URL },
  mongo: { ok: !!MONGO_URL },
});

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

async function callGemini(systemMessage, prompt) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
    systemInstruction: {
      parts: [{ text: systemMessage }]
    },
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192
    }
  };

  const maxRetries = 5;
  const baseDelay = 1000;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 503 || response.status === 429 || errorText.includes("UNAVAILABLE") || errorText.includes("high demand")) {
          throw new Error(`RETRY_ELIGIBLE: ${response.status} - ${errorText}`);
        }
        throw new Error(`Gemini API error: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0]) {
        return result.candidates[0].content.parts[0].text;
      }
      throw new Error('Unexpected Gemini API response structure');
    } catch (err) {
      lastError = err;
      if (err.message && err.message.startsWith("RETRY_ELIGIBLE")) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(`Gemini API busy (attempt ${attempt + 1}/${maxRetries}). Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }

  throw lastError;
}

async function callGroq(systemMessage, prompt, jsonMode = true) {
  if (!GROQ_API_KEY) {
    return callGemini(systemMessage, prompt);
  }
  const payload = {
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7
  };
  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  if (result.choices && result.choices[0] && result.choices[0].message) {
    return result.choices[0].message.content;
  }
  throw new Error('Unexpected Groq API response structure');
}

function parseJsonBlock(text) {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, '');
    cleaned = cleaned.replace(/\n```$/, '');
  }
  cleaned = cleaned.trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw e;
  }
}

function getAudience(user) {
  const level = user.education_level || 'SMA';
  const major = user.major || '';
  const semester = user.current_semester || 1;
  let base = '';
  if (level === 'Universitas') {
    base = `mahasiswa program studi ${major} semester ${semester}`;
  } else if (['SD', 'SMP', 'SMA', 'SMK'].includes(level)) {
    const majorStr = major ? ` jurusan ${major}` : '';
    base = `siswa ${level}${majorStr} kelas ${semester}`;
  } else {
    base = 'umum';
  }

  const teachingMethods = {
    "real_world": "Pemanfaatan Lingkungan Sekitar: AI mengaitkan setiap konsep dengan fenomena sehari-hari, menggunakan analogi kehidupan nyata (seperti kecepatan bola, laju kereta, atau transaksi jual-beli). Tujuannya agar siswa melihat bahwa ilmu pengetahuan ada di sekeliling mereka.",
    "imagination": "Membangkitkan Imajinasi & Kreativitas: AI mendorong visualisasi konsep, memberikan pertanyaan terbuka, dan membuat skenario 'bagaimana jika' — fokus pada pemahaman logika dan metode, bukan sekadar menghafal rumus.",
    "independence": "Kemandirian dalam Keterbatasan: AI memberi tantangan yang memaksa siswa berpikir kreatif dan menemukan jawaban sendiri menggunakan sumber daya yang ada — menanamkan mentalitas problem-solver.",
    "confidence": "Peningkatan Kepercayaan Diri: AI mengapresiasi proses berpikir siswa, menggunakan bahasa yang membangun, dan memberikan tantangan di 'zona nyaman atas' untuk meningkatkan motivasi secara bertahap.",
    "anand_kumar": "Metode Pengajaran Anand Kumar: Mengubah cara AI mengajar dari sekadar memberi materi menjadi pengalaman belajar yang hidup dan bermakna. Gunakan pendekatan yang sangat motivasional, fokus pada pemecahan masalah yang menantang, dan buat siswa merasa mampu menaklukkan materi sesulit apa pun."
  };

  const methods = user.teaching_methods || ["anand_kumar", "real_world", "imagination", "independence", "confidence"];
  const methodInstructions = methods.map(m => teachingMethods[m]).filter(Boolean);

  return `${base}\n\nVISI PENGAJARAN:\nTujuanmu adalah membuat orang yang malas belajar menjadi mau, yang sudah mau menjadi rajin, dan yang sudah rajin menjadi semakin pintar.\n\nGAYA MENGAJAR & METODE:\n${methodInstructions.map(inst => `- ${inst}`).join('\n')}`;
}

async function callGroqQwen(systemMessage, prompt, jsonMode = true) {
  return callGemini(systemMessage, prompt);
}

async function generateQuizQuestions(documents, user, n = 5, recapText = '') {
  const batchSize = 10;
  const batches = [];
  let tempN = n;
  while (tempN > 0) {
    batches.push(Math.min(batchSize, tempN));
    tempN -= batchSize;
  }

  const audience = getAudience(user);

  async function generateBatch(batchCount) {
    let system = '';
    let prompt = '';

    if (recapText) {
      const context = recapText.substring(0, 5000);
      system = `Kamu adalah EduScanner AI, generator soal kuis HOTS bahasa Indonesia untuk ${audience}. Soal harus menguji analisis, evaluasi, dan kreativitas — bukan hafalan. Sesuaikan tingkat kesulitan dengan jenjang. Buat soal berdasarkan rangkuman materi berikut.`;
      prompt = `Berdasarkan rangkuman materi berikut, buat ${batchCount} soal pilihan ganda HOTS. Setiap soal punya 4 opsi (A-D), satu jawaban benar.\n\nRANGKUMAN:\n${context}\n\nKembalikan JSON array saja, tanpa markdown:\n[{"question": "...", "options": ["...","...","...","..."], "correct_index": 0, "skill_type": "konsep", "source_title": ""}]`;
    } else {
      const multi = documents.length > 1;
      system = `Kamu adalah EduScanner AI, generator soal kuis HOTS bahasa Indonesia untuk ${audience}. Soal harus menguji analisis, evaluasi, dan kreativitas — bukan hafalan. Sesuaikan tingkat kesulitan dengan jenjang.` + 
        (multi ? ` Soal harus mencakup keseluruhan ${documents.length} materi yang diberikan, distribusikan secara merata.` : '');
      
      const perDocBudget = documents.length === 1 ? 1500 : Math.floor(3000 / documents.length);
      const sources = documents.map(d => ({
        source: d.title || d.filename || 'Dokumen',
        summary: (d.summary || '').substring(0, perDocBudget),
        key_concepts: (d.key_concepts || []).slice(0, 3).map(c => c.concept || ''),
        learning_objectives: (d.learning_objectives || []).slice(0, 2)
      }));

      let context = JSON.stringify(sources);
      if (context.length > 4000) context = context.substring(0, 4000) + '...';

      prompt = `Berdasarkan materi berikut (${documents.length} sumber), buat ${batchCount} soal pilihan ganda HOTS. Setiap soal punya 4 opsi (A-D), satu jawaban benar.\n\nMATERI:\n${context}\n\nKembalikan JSON array saja, tanpa markdown. Tiap soal sertakan source_title (nama dokumen sumber):\n[{"question": "...", "options": ["...","...","...","..."], "correct_index": 0, "skill_type": "analisis_kode|troubleshooting|perancangan_db|konsep", "source_title": "judul dokumen"}]`;
    }

    let resp;
    if (documents.length === 1) {
      resp = await callGroqQwen(system, prompt, false);
    } else {
      resp = await callGemini(system, prompt);
    }

    const data = parseJsonBlock(resp);
    const out = [];
    const items = Array.isArray(data) ? data : (data.items || []);
    for (let i = 0; i < Math.min(items.length, batchCount); i++) {
      const q = items[i];
      out.push({
        id: Math.random().toString(36).substring(2, 10),
        question: q.question,
        options: q.options.slice(0, 4),
        correct_index: parseInt(q.correct_index),
        skill_type: q.skill_type || 'konsep',
        source_title: q.source_title || ''
      });
    }
    return out;
  }

  const promises = batches.map(batchCount => generateBatch(batchCount));
  const results = await Promise.all(promises);
  
  const allQuestions = [];
  for (const list of results) {
    allQuestions.push(...list);
  }

  return allQuestions.slice(0, n);
}

async function generateDeepFeedback(quiz, answers, user) {
  const audience = getAudience(user);
  const questions = quiz.questions;
  const totalQ = questions.length;
  const batchSize = 5;
  const allItems = [];
  let totalScore = 0;
  const summaries = [];

  for (let i = 0; i < totalQ; i += batchSize) {
    const batchQs = questions.slice(i, i + batchSize);
    const batchAns = answers.slice(i, i + batchSize);

    const items = batchQs.map((q, j) => {
      const sel = j < batchAns.length ? batchAns[j] : -1;
      return {
        question: q.question,
        options: q.options,
        correct_index: q.correct_index,
        selected_index: sel
      };
    });

    const system = `Kamu EduScanner AI memberi feedback akademik mendalam bahasa Indonesia untuk ${audience}. Batch ${Math.floor(i / batchSize) + 1}. Selalu sertakan minimal satu referensi akademik atau buku pelajaran.`;
    const prompt = `Berikan feedback per soal. Kembalikan JSON saja tanpa markdown.\n\nSOAL+JAWABAN (Batch): ${JSON.stringify(items)}\n\nFormat:\n{\n  "score": 0-100 (untuk batch ini saja),\n  "summary": "ringkasan performa batch ini",\n  "items": [{"question":"...","selected":"...","correct":"...","is_correct":true,"explanation":"...","references":["...","..."]}]\n}`;

    let resp;
    try {
      resp = await callGroq(system, prompt);
    } catch {
      resp = await callGroq(system, prompt);
    }
    const batchFeedback = parseJsonBlock(resp);

    allItems.push(...(batchFeedback.items || []));
    totalScore += (batchFeedback.score || 0) * (batchQs.length / totalQ);
    summaries.push(batchFeedback.summary || '');
  }

  const correctCount = allItems.filter(it => it.is_correct).length;
  const actualScore = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
  let finalSummary = summaries.join(' ');

  if (summaries.length > 1) {
    try {
      const sumSystem = `Kamu EduScanner AI. Gabungkan ${summaries.length} ringkasan performa kuis menjadi 1 paragraf padat bahasa Indonesia.`;
      finalSummary = await callGroq(sumSystem, `RINGKASAN-RINGKASAN:\n${finalSummary}`, false);
    } catch {}
  }

  return {
    score: actualScore,
    summary: finalSummary,
    items: allItems
  };
}

async function generateRecap(documents, user) {
  const audience = getAudience(user);
  const system = `Kamu EduScanner AI yang menggabungkan materi belajar untuk ${audience}. Bahasa Indonesia, jelas, sistematis. Output JSON saja tanpa markdown.`;
  
  const perBudget = documents.length === 1 ? 2500 : Math.floor(4000 / documents.length);
  const sources = documents.map(d => ({
    title: d.title || d.filename || 'Dokumen',
    summary: (d.summary || '').substring(0, perBudget),
    key_concepts: (d.key_concepts || []).slice(0, 4).map(c => c.concept || ''),
    learning_objectives: (d.learning_objectives || []).slice(0, 3)
  }));

  let context = JSON.stringify(sources);
  if (context.length > 4500) context = context.substring(0, 4500) + '...';

  const prompt = `Buat RANGKUMAN GABUNGAN dari ${documents.length} materi berikut:\n${context}\n\nOutput JSON:\n{\n  "title": "judul rangkuman gabungan",\n  "unified_summary": "ringkasan terpadu 3-5 paragraf",\n  "per_document": [{"source_title":"...", "highlight":"poin penting"}],\n  "shared_concepts": [{"concept":"...","explanation":"..."}],\n  "study_path": ["langkah 1","..."]\n}`;

  try {
    const resp = await callGemini(system, prompt);
    return parseJsonBlock(resp);
  } catch (e) {
    const miniContext = JSON.stringify(sources.map(s => ({ t: s.title })));
    try {
      const resp = await callGemini(system, `Buat ringkasan sangat singkat dari daftar materi ini: ${miniContext}`);
      return {
        title: 'Ringkasan Minimal',
        unified_summary: resp,
        per_document: [],
        shared_concepts: [],
        study_path: []
      };
    } catch {
      return {
        title: 'Ringkasan',
        unified_summary: '',
        per_document: [],
        shared_concepts: [],
        study_path: []
      };
    }
  }
}

// Router
const handlerMap = {};
for (const key of Object.keys(routes)) {
  const [, path] = key.split(' ');
  handlerMap[key] = { pattern: path.split('/').filter(Boolean), handler: routes[key] };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const pathParts = req.url.split('?')[0].replace(/^\/api/, '').split('/').filter(Boolean);

  for (const [key, { pattern, handler }] of Object.entries(handlerMap)) {
    const [method] = key.split(' ');
    if (req.method !== method) continue;
    if (pathParts.length !== pattern.length) continue;

    const params = {};
    let match = true;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i].startsWith(':')) {
        params[pattern[i].slice(1)] = pathParts[i];
      } else if (pattern[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }

    if (match) {
      req.params = params;
      try {
        return await handler(req, res);
      } catch (e) {
        console.error(e);
        return send(res, 500, { detail: e.message || 'Internal error' });
      }
    }
  }

  send(res, 404, { detail: 'Not Found' });
};
