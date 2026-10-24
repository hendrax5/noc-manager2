export const TROUBLE_MASTER_KINDS = ['symptom', 'cause'];

export function normalizeMasterName(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase() : '';
}

export function canManageTroubleMasters(user) {
  return user?.role === 'Admin' || user?.role?.name === 'Admin' ||
    (user?.permissions ?? user?.role?.permissions ?? []).includes('manage_trouble_master');
}

export function validateTroubleMaster(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Data master tidak valid.');
  const data = {};
  if (!partial || Object.hasOwn(body, 'kind')) {
    if (!TROUBLE_MASTER_KINDS.includes(body.kind)) throw new Error('Jenis master tidak valid.');
    data.kind = body.kind;
  }
  if (!partial || Object.hasOwn(body, 'name')) {
    if (typeof body.name !== 'string') throw new Error('Nama wajib diisi (maksimal 80 karakter).');
    data.name = body.name.normalize('NFKC').trim().replace(/\s+/gu, ' ');
    if (!data.name || data.name.length > 80) throw new Error('Nama wajib diisi (maksimal 80 karakter).');
    data.normalizedName = normalizeMasterName(data.name);
  }
  if (Object.hasOwn(body, 'description')) {
    if (body.description !== null && (typeof body.description !== 'string' || body.description.length > 300)) throw new Error('Deskripsi maksimal 300 karakter.');
    data.description = body.description?.trim() || null;
  }
  if (Object.hasOwn(body, 'active')) {
    if (typeof body.active !== 'boolean') throw new Error('Status aktif tidak valid.');
    data.active = body.active;
  }
  if (Object.hasOwn(body, 'sortOrder')) {
    if (!Number.isInteger(body.sortOrder) || Math.abs(body.sortOrder) > 100000) throw new Error('Urutan harus bilangan bulat antara -100000 dan 100000.');
    data.sortOrder = body.sortOrder;
  }
  if (!Object.keys(data).length) throw new Error('Tidak ada perubahan master.');
  return data;
}

export function troubleMasterError(error) {
  if (error?.code === 'P2002') return { status: 409, error: 'Nama sudah digunakan pada jenis master ini.' };
  if (error?.code === 'P2003') return { status: 409, error: 'Master ini masih dipakai tiket dan tidak dapat dihapus. Nonaktifkan agar tidak muncul pada tiket baru.' };
  if (error?.code === 'P2025') return { status: 404, error: 'Master tidak ditemukan.' };
  return { status: 500, error: 'Master trouble gagal diproses. Coba lagi.' };
}
