import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api.js';

describe('Avisos de autenticación', () => {
  let dispatch;
  beforeEach(() => {
    dispatch = vi.fn();
    vi.stubGlobal('window', { dispatchEvent: dispatch });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401,
      json: async () => ({ message: 'Sin sesión' }),
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('abrir el login sin sesión no anuncia una sesión vencida', async () => {
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('avisa cuando una operación autenticada pierde la sesión', async () => {
    await expect(api.equipment()).rejects.toMatchObject({ status: 401 });
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0][0].type).toBe('session-expired');
  });
  it('las credenciales incorrectas se muestran en el formulario', async () => {
    await expect(api.login('demo@example.test', 'incorrecta')).rejects.toMatchObject({ status: 401 });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
