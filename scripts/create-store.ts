import { createClient } from '@supabase/supabase-js';
import * as crypto from 'node:crypto';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Simple zero-dependency env loader
function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: Falta configurar NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function generateTemporaryPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
  let password = '';
  const randomBytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return `${password}A1!`;
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true';
      result[key] = val;
    }
  }
  return result;
}

async function main() {
  const cli = parseCliArgs();
  const rl = readline.createInterface({ input, output });

  console.log('\n======================================================');
  console.log('🚀 Menuki - Alta Rápida de Tienda (Onboarding en 5m)');
  console.log('======================================================\n');

  try {
    const slug = (
      cli.slug ||
      (await rl.question('1. Identificador de URL / Slug (ej. la-trattoria): '))
    ).trim().toLowerCase();

    const name = (
      cli.name || (await rl.question('2. Nombre comercial de la tienda: '))
    ).trim();

    let whatsapp = (
      cli.whatsapp ||
      (await rl.question('3. Número de WhatsApp para pedidos (9 dígitos, ej. 987654321): '))
    ).trim().replace(/\D/g, '');

    if (whatsapp.length === 9 && whatsapp.startsWith('9')) {
      whatsapp = `51${whatsapp}`;
    }

    const email = (
      cli.email || (await rl.question('4. Correo del dueño/administrador: '))
    ).trim().toLowerCase();

    rl.close();

    console.log('\n⏳ Creando o verificando cuenta de usuario...');

    let userId: string;
    let tempPassword = '';

    // Check if user already exists
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = userList?.users.find((u) => u.email === email);

    if (existingUser) {
      userId = existingUser.id;
      console.log(`ℹ️ Usuario existente encontrado: ${email} (ID: ${userId})`);
    } else {
      tempPassword = generateTemporaryPassword();
      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
        });

      if (createError || !newUser.user) {
        throw new Error(`Error al crear usuario en Auth: ${createError?.message}`);
      }
      userId = newUser.user.id;
      console.log(`✅ Usuario creado exitosamente: ${email}`);
    }

    console.log('⏳ Registrando tienda en la base de datos...');

    const { data: storeResult, error: storeError } = await supabaseAdmin.rpc(
      'create_store',
      {
        p_slug: slug,
        p_name: name,
        p_whatsapp: whatsapp,
        p_owner_user_id: userId,
      } as any
    );

    if (storeError) {
      throw new Error(`Error al ejecutar create_store RPC: ${storeError.message}`);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    console.log('\n======================================================');
    console.log('🎉 ¡TIENDA CREADA CON ÉXITO!');
    console.log('======================================================');
    console.log(`• Nombre:        ${name}`);
    console.log(`• Slug:          ${slug}`);
    console.log(`• WhatsApp:      +${whatsapp}`);
    console.log(`• Catálogo URL:  ${appUrl}/${slug}`);
    console.log(`• Panel Admin:   ${appUrl}/${slug}/admin`);
    console.log('------------------------------------------------------');
    console.log('🔑 Credenciales de Acceso:');
    console.log(`• Usuario:       ${email}`);
    if (tempPassword) {
      console.log(`• Clave temporal: ${tempPassword}`);
      console.log('  (Indica al dueño cambiarla en su primer inicio de sesión)');
    } else {
      console.log('• Clave:          (Cuenta existente; usar contraseña habitual)');
    }
    console.log('======================================================\n');
  } catch (err: unknown) {
    console.error(`\n❌ Error en el proceso de alta: ${(err as Error).message}\n`);
    process.exit(1);
  }
}

main();
