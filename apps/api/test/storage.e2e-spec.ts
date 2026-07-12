import 'dotenv/config';
import { StorageService } from '../src/storage/storage.service';

describe('StorageService', () => {
  it('sube, lee y borra un objeto de prueba en Supabase Storage', async () => {
    const service = new StorageService();
    const key = 'verify-test/nestjs-conexion.txt';
    await service.putObject(key, Buffer.from('prueba nestjs'), 'text/plain');
    const client = service.getClient();
    const head = await client
      .headObject({ Bucket: service.getBucket(), Key: key })
      .catch(() => null);
    expect(head).not.toBeNull();
    await client.deleteObject({ Bucket: service.getBucket(), Key: key });
  });
});
