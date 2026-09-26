/** Anonymous per-install id: daily chat limit and "báo tôi khi có" requests. No personal data. */
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_KEY = 'ksmeals.device';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

let deviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;
  deviceId = (await AsyncStorage.getItem(DEVICE_KEY).catch(() => null)) ?? uuid();
  AsyncStorage.setItem(DEVICE_KEY, deviceId).catch(() => {});
  return deviceId;
}
