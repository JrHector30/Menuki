import { requireStoreMember } from '@/lib/auth/require-store-member';
import { StoreConfigForm } from '@/components/admin/store-config-form';

interface AdminConfiguracionPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AdminConfiguracionPage({ params }: AdminConfiguracionPageProps) {
  const { slug } = await params;
  const { store, role } = await requireStoreMember(slug);

  return (
    <div className="space-y-6 pb-20 sm:pb-6">
      <div>
        <h1 className="text-xl font-black text-neutral-900">Configuración de la Tienda</h1>
        <p className="text-xs text-neutral-500">
          Modifica los números de contacto, métodos de pago, horarios y color de acento.
        </p>
      </div>

      <StoreConfigForm slug={slug} store={store} role={role} />
    </div>
  );
}
