import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth, type RegisterForm } from '../context/AuthContext';
import './SignUp.css';

type AuthMode = 'login' | 'signup';
type ApiErrorDetail = string | { msg?: string } | { msg?: string }[];

function errorMessage(error: unknown) {
  if (isAxiosError<{ detail?: ApiErrorDetail }>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((item) => item.msg).filter(Boolean).join(' ');
    if (detail?.msg) return detail.msg;
  }
  return 'Unable to sign in or create your account. Please try again.';
}

function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
}

export default function SignUp() {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('signup');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<RegisterForm>({
    name: '', email: '', password: '', role: 'participant', college: '',
  });
  const isSignup = mode === 'signup';

  function updateForm(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
    setNotice('');
    setShowPassword(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setNotice('');
    if (isSignup && !form.name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    setSubmitting(true);
    try {
      if (isSignup) {
        await register({ ...form, name: form.name.trim(), email: form.email.trim() });
      } else {
        await login(form.email.trim(), form.password);
      }
      navigate('/', { replace: true });
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (!loading && user) return <Navigate to="/" replace />;

  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <div className="early-access"><Icon name="bolt" /><span>Early Access +100 XP</span></div>
        <section className="auth-card" aria-labelledby="auth-title">
          <header className="auth-brand">
            <img className="circuit-mark" src="/circuit-mark.png" alt="Circuit logo" width="56" height="56" />
            <div className="brand-title"><h1 id="auth-title">Circuit</h1><span className="campus-badge">Campus OS</span></div>
            <p>Discover campus events, earn XP, lead the ranks.</p>
          </header>

          <div className="auth-tabs" role="group" aria-label="Authentication mode">
            <button type="button" aria-pressed={!isSignup} className={!isSignup ? 'active' : ''} disabled={submitting} onClick={() => switchMode('login')}>Log in</button>
            <button type="button" aria-pressed={isSignup} className={isSignup ? 'active' : ''} disabled={submitting} onClick={() => switchMode('signup')}>Sign up</button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} aria-label={isSignup ? 'Create your Circuit account' : 'Log in to Circuit'} aria-busy={submitting}>
            <fieldset className="auth-fields" disabled={submitting || loading}>
              {isSignup && <div className="auth-field">
                <label htmlFor="full-name">Full Name <span className="field-hint">Public handle</span></label>
                <div className="input-wrap"><Icon name="badge" /><input id="full-name" name="name" autoComplete="name" placeholder="Your Name" value={form.name} onChange={updateForm} required /></div>
              </div>}
              <div className="auth-field">
                <label htmlFor="email">Email Address <span className="edu-hint">.edu preferred</span></label>
                <div className="input-wrap"><Icon name="alternate_email" /><input id="email" name="email" type="email" autoComplete="email" placeholder="your.email@university.edu" value={form.email} onChange={updateForm} required /></div>
              </div>
              {isSignup && <div className="auth-field">
                <label htmlFor="college">College / University</label>
                <div className="input-wrap"><Icon name="account_balance" />
                  <input id="college" name="college" type="text" autoComplete="organization" placeholder="Enter your college or university" value={form.college ?? ''} onChange={updateForm} />
                </div>
              </div>}
              <div className="auth-field">
                <div className="password-label"><label htmlFor="password">Password</label>{!isSignup && <button className="text-button" type="button" onClick={() => setNotice('Password reset is not available yet. Please contact your campus administrator for help.')}>Forgot password?</button>}</div>
                <div className="input-wrap"><Icon name="lock" /><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder="••••••••••••" value={form.password} onChange={updateForm} required minLength={isSignup ? 6 : undefined} />
                  <button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><Icon name={showPassword ? 'visibility_off' : 'visibility'} /></button>
                </div>
              </div>
              {isSignup && <fieldset className="role-field">
                <legend>Primary Campus Role</legend>
                <div className="role-options">
                  <label className={form.role === 'participant' ? 'active' : ''}><input type="radio" name="role" value="participant" checked={form.role === 'participant'} onChange={updateForm} /><span>Participant</span><span aria-hidden="true">⚡</span></label>
                  <label className={form.role === 'organizer' ? 'active' : ''}><input type="radio" name="role" value="organizer" checked={form.role === 'organizer'} onChange={updateForm} /><span>Organizer</span><span aria-hidden="true">🏛️</span></label>
                </div>
              </fieldset>}
              {error && <p className="auth-error" role="alert">{error}</p>}
              <div className="submit-wrap"><button className="auth-submit" type="submit">{submitting ? 'Please wait…' : isSignup ? 'Join Circuit & Claim 100 XP' : 'Log In to Campus Dashboard'}<Icon name="arrow_forward" /></button></div>
            </fieldset>
          </form>

          <p className="auth-footnote">{isSignup ? 'Already have an account?' : 'Need an account?'}{' '}<button className="text-button" type="button" disabled={submitting} onClick={() => switchMode(isSignup ? 'login' : 'signup')}>{isSignup ? 'Log in' : 'Sign up'}</button></p>
          {notice && <p className="auth-notice" role="status">{notice}</p>}
        </section>
        <footer className="auth-footer">
          <span className="campus-status"><span className="status-dot" />Circuit Campus</span>
          <nav aria-label="Legal and security">{['Privacy', 'Terms', 'Security'].map((label) => <button key={label} type="button" onClick={() => setNotice(`${label} information will be available here soon.`)}>{label}</button>)}</nav>
        </footer>
      </div>
    </main>
  );
}
