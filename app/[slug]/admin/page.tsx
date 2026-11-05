import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStoreMember } from '@/lib/auth/require-store-member';
import { formatCurrency } from '@/lib/utils/currency';

interface AdminDashboardPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AdminDashboardPage({ params }: AdminDashboardPageProps) {
  const { slug } = await params;
  const { store } = await requireStoreMember(slug);
  const supabase = await createClient();

  // 1. Calculate Start and End of Today in America/Lima timezone (UTC-5)
  const now = new Date();
  const limaFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayLimaStr = limaFormatter.format(now); // "YYYY-MM-DD"
  const startOfDayIso = `${todayLimaStr}T00:00:00-05:00`;
  const endOfDayIso = `${todayLimaStr}T23:59:59.999-05:00`;

  // 2. Fetch today's orders and pending orders in parallel
  const [todayOrdersRes, pendingCountRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total, status, created_at')
      .eq('store_id', store.id)
      .gte('created_at', startOfDayIso)
      .lte('created_at', endOfDayIso),
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', store.id)
      .eq('status', 'pending'),
  ]);

  const hasQueryError = !!todayOrdersRes.error || !!pendingCountRes.error;
  const orders = todayOrdersRes.data ?? [];
  const pendingCount = pendingCountRes.count ?? 0;

  // Exclude cancelled orders for sales and ticket metrics
  const validOrders = orders.filter((o) => o.status !== 'cancelled');
  const totalSales = validOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const totalValidOrdersCount = validOrders.length;
  const averageTicket = totalValidOrdersCount > 0 ? totalSales / totalValidOrdersCount : 0;

  return (
    <div className="space-y-6 pb-20 sm:pb-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-neutral-900">Dashboard</h1>
          <p className="text-xs text-neutral-500">
            Resumen de actividad comercial del día ({todayLimaStr}) en hora de Perú.
          </p>
        </div>
        <Link
          href={`/${slug}/admin/pedidos`}
          className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-neutral-900 px-4 text-xs font-bold text-white transition hover:bg-neutral-800"
        >
          Ver todos los pedidos →
        </Link>
      </div>

      {hasQueryError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
          ⚠️ <strong>Aviso:</strong> No se pudieron cargar las estadísticas del día en tiempo real. Por favor, recarga la página o verifica la conexión.
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Pending Orders */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Pedidos Pendientes
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 text-sm">
              ⏳
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-neutral-950">
              {hasQueryError ? '--' : pendingCount}
            </span>
            <span className="text-xs text-neutral-500">por atender</span>
          </div>
        </div>

        {/* Metric 2: Today's Sales */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Ventas del Día
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 text-sm">
              💵
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-neutral-950">
              {hasQueryError ? '--' : formatCurrency(totalSales)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-neutral-400">Excluye pedidos cancelados</p>
        </div>

        {/* Metric 3: Total Orders */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Pedidos de Hoy
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 text-sm">
              📦
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-neutral-950">
              {hasQueryError ? '--' : totalValidOrdersCount}
            </span>
            <span className="text-xs text-neutral-500">
              ({hasQueryError ? '--' : orders.length - totalValidOrdersCount} cancelados)
            </span>
          </div>
        </div>

        {/* Metric 4: Average Ticket */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Ticket Promedio
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600 text-sm">
              🏷️
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-neutral-950">
              {hasQueryError ? '--' : formatCurrency(averageTicket)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-neutral-400">Por pedido efectivo</p>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">
          Accesos Rápidos
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link
            href={`/${slug}/admin/pedidos`}
            className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-900"
          >
            <div>
              <span className="font-bold text-neutral-900">Control de Pedidos</span>
              <p className="text-xs text-neutral-500">Gestionar estados y contactar clientes</p>
            </div>
            <span className="text-xl">📦</span>
          </Link>

          <Link
            href={`/${slug}/admin/productos`}
            className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-900"
          >
            <div>
              <span className="font-bold text-neutral-900">Administrar Carta</span>
              <p className="text-xs text-neutral-500">Precios, disponibilidad e imágenes</p>
            </div>
            <span className="text-xl">🍔</span>
          </Link>

          <Link
            href={`/${slug}/admin/configuracion`}
            className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-900"
          >
            <div>
              <span className="font-bold text-neutral-900">Configuración del Local</span>
              <p className="text-xs text-neutral-500">WhatsApp, Yape/Plin y horarios</p>
            </div>
            <span className="text-xl">⚙️</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
