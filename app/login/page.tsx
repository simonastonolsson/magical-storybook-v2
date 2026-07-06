"use client";

import { useState } from 'react';
import { signInWithEmail, signInWithGoogle } from '@/app/auth/actions';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailSignIn = async (formData: FormData) => {
    setIsSubmitting(true);
    setStatus(null);
    const result = await signInWithEmail(formData);
    setIsSubmitting(false);
    setStatus(
      result?.error
        ? result.error
        : 'Kolla din inkorg! Vi har skickat en inloggningslänk.'
    );
  };

  return (
    <main style={{ minHeight: '100vh', background: '#faf8f3', fontFamily: 'Inter, sans-serif', color: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '380px', background: 'white', border: '1.5px solid #e5e0d8', borderRadius: '20px', padding: '2rem' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 900, marginBottom: '0.5rem' }}>
          Logga in
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          Logga in för att spara och komma åt dina tränade AI-karaktärer.
        </p>

        <form action={handleEmailSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
          <input
            type="email"
            name="email"
            placeholder="din@epost.se"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '0.8rem 1rem', border: '1.5px solid #e5e0d8', borderRadius: '12px', fontSize: '1rem', fontFamily: 'Inter, sans-serif', background: '#faf8f3', outline: 'none' }}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            style={{ width: '100%', padding: '0.85rem', background: '#7c3aed', color: 'white', fontWeight: 700, fontSize: '0.95rem', border: 'none', borderRadius: '12px', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : 1 }}
          >
            {isSubmitting ? 'Skickar länk...' : 'Skicka inloggningslänk'}
          </button>
        </form>

        {status && (
          <div style={{ padding: '0.75rem 1rem', background: '#ede9fe', color: '#5b21b6', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {status}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1rem 0' }}>
          <div style={{ flex: 1, height: '1px', background: '#e5e0d8' }} />
          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>eller</span>
          <div style={{ flex: 1, height: '1px', background: '#e5e0d8' }} />
        </div>

        <form action={signInWithGoogle}>
          <button
            type="submit"
            style={{ width: '100%', padding: '0.8rem', background: 'white', color: '#1a1a2e', fontWeight: 600, fontSize: '0.95rem', border: '1.5px solid #e5e0d8', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}
          >
            Fortsätt med Google
          </button>
        </form>
      </div>
    </main>
  );
}
