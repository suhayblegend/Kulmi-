import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Users, AlertTriangle, MessageSquare, Settings, Activity, Menu, X,
  BarChart3, UserCheck, Star, CheckCircle, XCircle, LogOut, Heart, Loader2, ShieldCheck,
  Search, Trash2, EyeOff, Eye, Key, Mail, Send,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  getAdminStats, adminListUsers, adminListPendingVerifications, adminReviewVerification,
  adminSetRole, adminSetDiscovery, adminDeleteUser,
  adminListSessions, adminListChats, adminListReports, adminListSuccesses, adminUpdateReport, readTranscript,
  adminListContactMessages, adminMarkContactHandled,
  adminCountRecipients, adminBroadcast,
  getMyProfile, signOut, avatarFor, resolveMediaUrl,
  type AdminStats, type Profile, type AdminPair, type ReportRow, type Message, type ContactMessage, type BroadcastAudience,
} from '../lib/db';

interface AdminDashboardProps {
  onExit: () => void;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();

export function AdminDashboard({ onExit }: AdminDashboardProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [pending, setPending] = useState<Profile[]>([]);
  const [selfieUrls, setSelfieUrls] = useState<Record<string, string>>({});
  const [sessions, setSessions] = useState<AdminPair[]>([]);
  const [chats, setChats] = useState<AdminPair[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [successes, setSuccesses] = useState<AdminPair[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Email blast
  const [blastSubject, setBlastSubject] = useState('');
  const [blastBody, setBlastBody] = useState('');
  const [blastAudience, setBlastAudience] = useState<BroadcastAudience>('verified');
  const [blastCount, setBlastCount] = useState<number | null>(null);
  const [blastSending, setBlastSending] = useState(false);
  const [blastResult, setBlastResult] = useState('');
  useEffect(() => {
    setBlastCount(null);
    adminCountRecipients(blastAudience).then(setBlastCount).catch(() => setBlastCount(null));
  }, [blastAudience]);
  const handleBlast = async () => {
    setBlastResult('');
    if (!blastSubject.trim() || blastBody.trim().length < 5) { setBlastResult('Add a subject and a message first.'); return; }
    if (!window.confirm(`Send this email to ${blastCount ?? 'all'} ${blastAudience === 'verified' ? 'verified ' : ''}members?`)) return;
    setBlastSending(true);
    try {
      const r = await adminBroadcast(blastSubject.trim(), blastBody, blastAudience);
      if (r.sent > 0) {
        setBlastResult(`✅ Sent to ${r.sent} member${r.sent === 1 ? '' : 's'}.`);
        setBlastSubject(''); setBlastBody('');
      } else {
        const why = r.errors?.length ? ` — Resend said: ${r.errors[0]}` : (r.note ? ` — ${r.note}` : '');
        setBlastResult(`⚠️ Sent to 0. Nothing went out${why}. Check the audience (try "All members") and that the sender is set up.`);
      }
    } catch (e: any) {
      setBlastResult(`⚠️ ${e?.message || 'Could not send. Is the email sender set up?'}`);
    } finally {
      setBlastSending(false);
    }
  };
  const [transcript, setTranscript] = useState<{ title: string; messages: Message[] } | null>(null);
  const [userSearch, setUserSearch] = useState('');

  // Admin settings tab
  const [adminEmail, setAdminEmail] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    getMyProfile().then((p) => setAdminEmail(p?.email ?? '')).catch(() => {});
  }, []);

  const changePassword = async () => {
    setPwdMsg(''); setPwdErr('');
    if (newPwd.length < 6) { setPwdErr('Password must be at least 6 characters.'); return; }
    if (newPwd !== confirmPwd) { setPwdErr('Passwords do not match.'); return; }
    setSavingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      setPwdMsg('Password updated.'); setNewPwd(''); setConfirmPwd('');
    } catch (e: any) {
      setPwdErr(e.message || 'Could not update password.');
    } finally {
      setSavingPwd(false);
    }
  };

  const handleSetRole = async (userId: string, role: 'user' | 'wali' | 'admin') => { await adminSetRole(userId, role); await reload(); };
  const handleDiscovery = async (userId: string, show: boolean) => { await adminSetDiscovery(userId, show); await reload(); };
  const handleDeleteUser = async (userId: string, name: string) => {
    if (!window.confirm(`Delete ${name}'s profile? This cannot be undone.`)) return;
    await adminDeleteUser(userId);
    await reload();
  };

  const reload = async () => {
    setLoading(true);
    const [s, u, p, se, c, r, su, cm] = await Promise.all([
      getAdminStats(), adminListUsers(), adminListPendingVerifications(),
      adminListSessions(), adminListChats(), adminListReports(), adminListSuccesses(),
      adminListContactMessages(),
    ]);
    setStats(s); setUsers(u); setPending(p); setSessions(se); setChats(c); setReports(r); setSuccesses(su); setMessages(cm);
    // Selfies live in the private bucket — resolve to short-lived signed URLs for review.
    const selfies: Record<string, string> = {};
    await Promise.all(p.map(async (v: any) => {
      const url = await resolveMediaUrl(v.verification_selfie_url);
      if (url) selfies[v.id] = url;
    }));
    setSelfieUrls(selfies);
    setLoading(false);
  };

  useEffect(() => {
    reload().catch(() => setLoading(false));
  }, []);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'users', label: 'Users', icon: <Users className="w-5 h-5" /> },
    { id: 'verifications', label: `Verifications${stats?.pendingVerifications ? ` (${stats.pendingVerifications})` : ''}`, icon: <UserCheck className="w-5 h-5" /> },
    { id: 'sessions', label: 'Sessions', icon: <Heart className="w-5 h-5" /> },
    { id: 'conversations', label: 'Conversations', icon: <MessageSquare className="w-5 h-5" /> },
    { id: 'reports', label: `Reports${stats?.pendingReports ? ` (${stats.pendingReports})` : ''}`, icon: <AlertTriangle className="w-5 h-5" /> },
    { id: 'successes', label: `Successes${stats?.successes ? ` (${stats.successes})` : ''}`, icon: <Star className="w-5 h-5" /> },
    { id: 'messages', label: `Messages${messages.filter((m) => !m.handled).length ? ` (${messages.filter((m) => !m.handled).length})` : ''}`, icon: <Mail className="w-5 h-5" /> },
    { id: 'broadcast', label: 'Email Blast', icon: <Send className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ];

  const handleContactHandled = async (id: string, handled: boolean) => {
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, handled } : m)));
    try { await adminMarkContactHandled(id, handled); } catch { await reload(); }
  };

  const handleReview = async (userId: string, approve: boolean) => {
    await adminReviewVerification(userId, approve);
    await reload();
  };

  const handleReport = async (id: string, status: 'reviewed' | 'dismissed') => {
    await adminUpdateReport(id, status);
    await reload();
  };

  const openTranscript = async (pair: AdminPair) => {
    const messages = await readTranscript(pair.id);
    setTranscript({ title: `${pair.userA} & ${pair.userB}`, messages });
  };

  const StatCard = ({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) => (
    <div className="bg-white p-6 rounded-2xl border border-[#E5E0D8] shadow-sm">
      <div className="w-12 h-12 rounded-full bg-[#FDFBF7] flex items-center justify-center border border-[#E5E0D8] mb-4">{icon}</div>
      <h3 className="text-[#8B7355] text-sm font-medium">{label}</h3>
      <p className="text-2xl font-serif text-[#1B4332] mt-1">{value}</p>
    </div>
  );

  const Empty = ({ text }: { text: string }) => (
    <div className="flex flex-col items-center justify-center py-16 text-[#8B7355]">
      <Activity className="w-10 h-10 mb-3 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <StatCard label="Total Users" value={stats?.users ?? 0} icon={<Users className="w-6 h-6 text-[#1B4332]" />} />
      <StatCard label="Verified" value={stats?.verified ?? 0} icon={<ShieldCheck className="w-6 h-6 text-green-600" />} />
      <StatCard label="Pending Verifications" value={stats?.pendingVerifications ?? 0} icon={<UserCheck className="w-6 h-6 text-orange-500" />} />
      <StatCard label="Matches (Chats)" value={stats?.matches ?? 0} icon={<Heart className="w-6 h-6 text-pink-500" />} />
      <StatCard label="Active Sessions" value={stats?.activeSessions ?? 0} icon={<Activity className="w-6 h-6 text-blue-500" />} />
      <StatCard label="Open Reports" value={stats?.pendingReports ?? 0} icon={<AlertTriangle className="w-6 h-6 text-red-500" />} />
      <StatCard label="Success Stories" value={stats?.successes ?? 0} icon={<Star className="w-6 h-6 text-yellow-500" />} />
    </div>
  );

  const renderSuccesses = () =>
    successes.length === 0 ? <Empty text="No confirmed engagements or marriages yet." /> : (
      <Table head={['Person A', 'Person B', 'Outcome', 'Confirmed']}>
        {successes.map((s) => (
          <tr key={s.id} className="hover:bg-[#FDFBF7]/50">
            <td className="p-4 font-medium text-[#1B4332]">{s.userA}</td>
            <td className="p-4 font-medium text-[#1B4332]">{s.userB}</td>
            <td className="p-4"><span className={`px-2 py-1 rounded-md text-xs font-medium capitalize ${s.status === 'married' ? 'bg-pink-100 text-pink-800' : 'bg-yellow-100 text-yellow-800'}`}>{s.status}</span></td>
            <td className="p-4 text-[#5C574F]">{s.created_at ? fmtDate(s.created_at) : '—'}</td>
          </tr>
        ))}
      </Table>
    );

  const renderMessages = () =>
    messages.length === 0 ? <Empty text="No contact messages yet." /> : (
      <div className="space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`bg-white rounded-2xl border shadow-sm p-5 ${m.handled ? 'border-[#E5E0D8] opacity-70' : 'border-[#1B4332]/30'}`}>
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <p className="font-medium text-[#1B4332]">{m.name || 'Anonymous'}</p>
                {m.email && <a href={`mailto:${m.email}`} className="text-sm text-[#8B7355] hover:text-[#1B4332] hover:underline">{m.email}</a>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-[#8B7355]">{fmtDate(m.created_at)}</span>
                <button onClick={() => handleContactHandled(m.id, !m.handled)} className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${m.handled ? 'bg-[#F0EEE8] text-[#8B7355] hover:bg-[#E5E0D8]' : 'bg-[#1B4332] text-white hover:bg-[#143326]'}`}>
                  {m.handled ? 'Handled ✓' : 'Mark handled'}
                </button>
              </div>
            </div>
            <p className="text-sm text-[#2D2926] whitespace-pre-wrap leading-relaxed">{m.message}</p>
            {m.email && (
              <a href={`mailto:${m.email}?subject=Re: your message to Kulmi`} className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-[#1B4332] hover:underline">
                <Mail className="w-3.5 h-3.5" /> Reply by email
              </a>
            )}
          </div>
        ))}
      </div>
    );

  const renderBroadcast = () => (
    <div className="max-w-2xl space-y-5">
      <div className="bg-white rounded-2xl border border-[#E5E0D8] shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">Send to</label>
          <div className="flex flex-wrap gap-2">
            {([['verified', 'Verified members'], ['all', 'All members']] as [BroadcastAudience, string][]).map(([val, lbl]) => (
              <button key={val} onClick={() => setBlastAudience(val)} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${blastAudience === val ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white border-[#E5E0D8] text-[#2D2926] hover:bg-[#FDFBF7]'}`}>{lbl}</button>
            ))}
            <span className="px-4 py-2 rounded-xl text-sm font-medium border border-dashed border-[#E5E0D8] text-[#8B7355]" title="Available once paid plans are added">Premium (with billing)</span>
          </div>
          <p className="text-xs text-[#8B7355] mt-2">{blastCount === null ? 'Counting recipients…' : `${blastCount} recipient${blastCount === 1 ? '' : 's'}`}</p>
        </div>
        <div>
          <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">Subject</label>
          <input value={blastSubject} onChange={(e) => setBlastSubject(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-[#1B4332]" placeholder="e.g. New matches waiting for you on Kulmi" />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">Message</label>
          <textarea rows={8} value={blastBody} onChange={(e) => setBlastBody(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] focus:outline-none focus:ring-2 focus:ring-[#1B4332] resize-none" placeholder="Write your message. Plain text — blank lines become paragraphs." />
        </div>
        {blastResult && <p className={`text-sm ${blastResult.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>{blastResult}</p>}
        <button onClick={handleBlast} disabled={blastSending} className="w-full py-4 rounded-xl bg-[#1B4332] text-white font-medium hover:bg-[#143326] transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
          {blastSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Send email blast</>}
        </button>
      </div>
      <p className="text-xs text-[#8B7355] leading-relaxed">
        Emails send from <span className="font-medium">noreply@kulmi.uk</span> via Resend. If sending isn't working, the
        <span className="font-medium"> broadcast</span> function or Resend key may not be set up yet.
      </p>
    </div>
  );

  const Table = ({ head, children }: { head: string[]; children: React.ReactNode }) => (
    <div className="bg-white rounded-2xl border border-[#E5E0D8] shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#FDFBF7] text-xs uppercase tracking-wider text-[#8B7355] border-b border-[#E5E0D8]">
              {head.map((h) => <th key={h} className="p-4 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-[#E5E0D8]">{children}</tbody>
        </table>
      </div>
    </div>
  );

  const renderUsers = () => {
    const q = userSearch.trim().toLowerCase();
    const filtered = q
      ? users.filter((u) => `${u.first_name ?? ''} ${u.email ?? ''} ${u.city ?? ''} ${u.location ?? ''}`.toLowerCase().includes(q))
      : users;
    return (
      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7355]" />
          <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search name, email, city…" className="w-full pl-9 pr-4 py-2 text-sm border border-[#E5E0D8] rounded-xl bg-white focus:outline-none focus:border-[#1B4332]" />
        </div>
        {filtered.length === 0 ? <Empty text="No users match." /> : (
          <Table head={['Name', 'Gender', 'Location', 'Verified', 'Role', 'Actions']}>
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-[#FDFBF7]/50">
                <td className="p-4"><div className="font-medium text-[#1B4332]">{u.first_name || '—'}{u.age ? `, ${u.age}` : ''}</div><div className="text-xs text-[#8B7355]">{u.email}</div></td>
                <td className="p-4 text-[#5C574F] capitalize">{u.gender || '—'}</td>
                <td className="p-4 text-[#5C574F]">{u.location || u.city || '—'}</td>
                <td className="p-4">
                  <button
                    onClick={() => handleReview(u.id, u.verification_status !== 'verified')}
                    title={u.verification_status === 'verified' ? 'Click to un-verify' : 'Click to verify'}
                    className={`px-2 py-1 rounded-md text-xs font-medium ${u.verification_status === 'verified' ? 'bg-green-100 text-green-800' : u.verification_status === 'pending' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-700'}`}>
                    {u.verification_status || 'unverified'}
                  </button>
                </td>
                <td className="p-4">
                  <select value={u.role} onChange={(e) => handleSetRole(u.id, e.target.value as any)} className="text-xs border border-[#E5E0D8] rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-[#1B4332]">
                    <option value="user">user</option>
                    <option value="wali">wali</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleDiscovery(u.id, u.show_in_discovery === false)} title={u.show_in_discovery === false ? 'Un-hide (show in discovery)' : 'Hide from discovery'} className="p-1.5 rounded-lg text-[#8B7355] hover:text-[#1B4332] hover:bg-[#F0EEE8]">
                      {u.show_in_discovery === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleDeleteUser(u.id, u.first_name || 'this user')} title="Delete profile" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    );
  };

  const renderSettings = () => (
    <div className="max-w-lg space-y-6">
      <div className="bg-white rounded-2xl border border-[#E5E0D8] shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4"><ShieldCheck className="w-5 h-5 text-[#1B4332]" /><h3 className="font-serif text-lg text-[#1B4332]">Admin account</h3></div>
        {adminEmail && <p className="text-sm text-[#8B7355] mb-4">Signed in as <span className="font-medium text-[#2D2926]">{adminEmail}</span></p>}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1"><Key className="w-4 h-4 text-[#8B7355]" /><span className="text-sm font-bold text-[#1B4332]">Change Password</span></div>
          <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="New password (min 6 chars)" className="w-full px-4 py-2.5 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] text-sm focus:outline-none focus:border-[#1B4332]" />
          <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Confirm new password" className="w-full px-4 py-2.5 rounded-xl border border-[#E5E0D8] bg-[#FDFBF7] text-sm focus:outline-none focus:border-[#1B4332]" />
          {pwdErr && <p className="text-sm text-red-600">{pwdErr}</p>}
          {pwdMsg && <p className="text-sm text-green-700">{pwdMsg}</p>}
          <button onClick={changePassword} disabled={savingPwd} className="bg-[#1B4332] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#143326] transition-colors disabled:opacity-50 flex items-center gap-2">
            {savingPwd ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
          </button>
        </div>
      </div>
      <button onClick={() => signOut()} className="w-full bg-white border border-[#E5E0D8] text-red-600 px-5 py-3 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
        <LogOut className="w-4 h-4" /> Sign out of admin
      </button>
    </div>
  );

  const renderVerifications = () =>
    pending.length === 0 ? <Empty text="No pending verifications." /> : (
      <div className="space-y-5">
      <div className="bg-[#FDFBF7] border border-[#E5E0D8] rounded-2xl p-4 text-sm text-[#5C574F]">
        <p className="font-bold text-[#1B4332] mb-1">Approve only genuine people. Reject if:</p>
        <p>the profile photo doesn't clearly match the live selfie · the face is hidden (sunglasses, mask, heavy filter) · it looks AI-generated, a celebrity, a stock photo, or not a real person · no clear human face. The <b>left</b> image is their profile photo; the <b>right</b> is their live selfie — they should be the same real person.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pending.map((v) => (
          <div key={v.id} className="bg-white rounded-2xl border border-[#E5E0D8] overflow-hidden shadow-sm">
            <div className="grid grid-cols-2 h-48 border-b border-[#E5E0D8]">
              <div className="bg-[#F0EEE8] flex items-center justify-center overflow-hidden">
                <img src={avatarFor(v)} alt="profile" className="w-full h-full object-cover" />
              </div>
              <div className="bg-[#E5E0D8] flex items-center justify-center overflow-hidden border-l border-[#E5E0D8]">
                {selfieUrls[v.id]
                  ? <img src={selfieUrls[v.id]} alt="selfie" className="w-full h-full object-cover" />
                  : <span className="text-xs text-[#8B7355] uppercase tracking-widest">{v.verification_selfie_url ? 'Loading…' : 'No selfie'}</span>}
              </div>
            </div>
            <div className="p-5">
              <h4 className="font-medium text-[#1B4332] mb-4">{v.first_name || 'Member'}{v.age ? `, ${v.age}` : ''}</h4>
              <div className="flex gap-3">
                <button onClick={() => handleReview(v.id, true)} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                <button onClick={() => handleReview(v.id, false)} className="flex-1 bg-white border border-red-200 text-red-500 hover:bg-red-50 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>
    );

  const renderSessions = () =>
    sessions.length === 0 ? <Empty text="No sessions yet." /> : (
      <Table head={['Person A', 'Person B', 'Status', 'Started']}>
        {sessions.map((s) => (
          <tr key={s.id} className="hover:bg-[#FDFBF7]/50">
            <td className="p-4 font-medium text-[#1B4332]">{s.userA}</td>
            <td className="p-4 font-medium text-[#1B4332]">{s.userB}</td>
            <td className="p-4"><span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 capitalize">{s.status}</span></td>
            <td className="p-4 text-[#5C574F]">{fmtDate(s.created_at)}</td>
          </tr>
        ))}
      </Table>
    );

  const renderConversations = () =>
    chats.length === 0 ? <Empty text="No conversations yet." /> : (
      <Table head={['Person A', 'Person B', 'Started', '']}>
        {chats.map((c) => (
          <tr key={c.id} className="hover:bg-[#FDFBF7]/50">
            <td className="p-4 font-medium text-[#1B4332]">{c.userA}</td>
            <td className="p-4 font-medium text-[#1B4332]">{c.userB}</td>
            <td className="p-4 text-[#5C574F]">{fmtDate(c.created_at)}</td>
            <td className="p-4 text-right"><button onClick={() => openTranscript(c)} className="text-sm text-[#1B4332] font-medium hover:underline">View transcript</button></td>
          </tr>
        ))}
      </Table>
    );

  const renderReports = () =>
    reports.length === 0 ? <Empty text="No reports — all clear." /> : (
      <Table head={['Reported', 'By', 'Reason', 'Status', 'Date', '']}>
        {reports.map((r) => (
          <tr key={r.id} className="hover:bg-[#FDFBF7]/50">
            <td className="p-4 font-medium text-[#1B4332]">{r.reported}</td>
            <td className="p-4 text-[#5C574F]">{r.reporter}</td>
            <td className="p-4 text-[#5C574F]">{r.reason}</td>
            <td className="p-4"><span className={`px-2 py-1 rounded-md text-xs font-medium ${r.status === 'pending' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-700'}`}>{r.status}</span></td>
            <td className="p-4 text-[#5C574F]">{fmtDate(r.created_at)}</td>
            <td className="p-4 text-right">
              {r.status === 'pending' && (
                <div className="flex gap-2 justify-end">
                  <button onClick={() => handleReport(r.id, 'reviewed')} className="px-3 py-1 bg-[#1B4332] text-white rounded-lg text-xs font-medium">Reviewed</button>
                  <button onClick={() => handleReport(r.id, 'dismissed')} className="px-3 py-1 border border-[#E5E0D8] text-[#5C574F] rounded-lg text-xs font-medium">Dismiss</button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
    );

  const renderContent = () => {
    if (loading) return <div className="flex justify-center py-24 text-[#8B7355]"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'users': return renderUsers();
      case 'verifications': return renderVerifications();
      case 'sessions': return renderSessions();
      case 'conversations': return renderConversations();
      case 'reports': return renderReports();
      case 'successes': return renderSuccesses();
      case 'messages': return renderMessages();
      case 'broadcast': return renderBroadcast();
      case 'settings': return renderSettings();
      default: return <Empty text="Coming soon." />;
    }
  };

  return (
    <div className="flex h-screen bg-[#FDFBF7] font-sans">
      {isSidebarOpen && (
        <aside className="flex-shrink-0 w-[260px] bg-[#1B4332] text-white flex flex-col h-full">
          <div className="p-6 flex items-center justify-between">
            <h1 className="text-2xl font-serif italic tracking-wide">Kulmi Admin</h1>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 hover:bg-white/10 rounded-md"><X className="w-5 h-5" /></button>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-white/10 text-white font-medium' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
                {item.icon}<span className="text-sm">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-white/10">
            <button onClick={onExit} className="w-full flex items-center gap-3 px-4 py-3 text-white/70 hover:bg-white/5 hover:text-white rounded-xl transition-colors text-sm">
              <LogOut className="w-5 h-5" /><span>Exit Dashboard</span>
            </button>
          </div>
        </aside>
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-20 bg-white border-b border-[#E5E0D8] flex items-center justify-between px-6 shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-[#8B7355] hover:bg-[#F0EEE8] rounded-xl"><Menu className="w-5 h-5" /></button>}
            <h2 className="text-lg font-serif text-[#1B4332] capitalize">{activeTab}</h2>
          </div>
          <button onClick={reload} className="text-sm font-medium text-[#8B7355] hover:text-[#1B4332]">Refresh</button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="max-w-7xl mx-auto">
            {renderContent()}
          </motion.div>
        </div>
      </main>

      {/* Transcript modal */}
      {transcript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setTranscript(null)} />
          <div className="relative bg-white w-full max-w-lg max-h-[80vh] rounded-2xl border border-[#E5E0D8] shadow-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#E5E0D8] flex items-center justify-between bg-[#FDFBF7]">
              <h3 className="font-serif text-[#1B4332]">{transcript.title}</h3>
              <button onClick={() => setTranscript(null)} className="p-1 text-[#8B7355] hover:text-[#1B4332]"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {transcript.messages.length === 0 && <p className="text-sm text-[#8B7355] text-center py-8">No messages yet.</p>}
              {transcript.messages.map((m) => (
                <div key={m.id} className="text-sm bg-[#FDFBF7] border border-[#E5E0D8] rounded-lg p-2">
                  <span className="text-[10px] uppercase tracking-wider text-[#8B7355]">{fmtDate(m.created_at)}</span>
                  <p className="text-[#2D2926]">{m.type === 'audio' ? '🎤 Voice note' : m.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
