'use client';

import { useState } from 'react';
import { resetOwnerPasswordAction } from '@/app/actions/superadmin-actions';

interface ResetPasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  storeName: string;
}

export function ResetPasswordDialog({
  isOpen,
  onClose,
  userId,
  userEmail,
  storeName,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleGeneratePassword() {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const generated = Array.from(bytes, (b) => chars[b % chars.length]).join('');
    setPassword(generated);
    setCopied(false);
  }

  async function handleCopy() {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetOwnerPasswordAction(userId, password);
      if (!res.ok) {
        setErrorMessage(res.error || 'Error al actualizar contraseña.');
      } else {
        setSuccessMessage('¡Contraseña actualizada con éxito!');
      }
    } catch {
      setErrorMessage('Error de conexión al procesar la solicitud.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Cambiar Contraseña</h2>
            <p className="text-xs text-neutral-500">
              {storeName} &bull; {userEmail}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            ✕
          </button>
        </div>

        {successMessage ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-800">
              <p className="text-sm font-semibold">{successMessage}</p>
              <p className="mt-1 text-xs">
                La nueva contraseña ya está activa. Asegúrate de enviársela al cliente.
              </p>
              {password && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2">
                  <span className="font-mono text-xs font-bold text-neutral-800">{password}</span>
                  <button
                    onClick={handleCopy}
                    className="ml-auto rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-emerald-700"
                  >
                    {copied ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setPassword('');
                setSuccessMessage(null);
                onClose();
              }}
              className="w-full rounded-xl bg-neutral-900 py-2.5 text-xs font-bold text-white transition hover:bg-neutral-800"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {errorMessage && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                {errorMessage}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-700">
                Nueva Contraseña
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 font-mono text-xs text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="shrink-0 rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                >
                  Generar
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || password.length < 8}
                className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando...' : 'Actualizar contraseña'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
