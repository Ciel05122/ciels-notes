// 高德地图 Web 服务：周边地点列表（朋友圈式选点）+ 关键字搜索 + 粗略区域。
// Key 是 Web 服务类型，设计上可用于前端请求。

// Key 从环境变量读，不进仓库。没有配置时「选地点」降级为手动输入，不影响其它功能。
const AMAP_KEY = import.meta.env.VITE_AMAP_KEY ?? '';

export interface Place {
  name: string;
  address?: string;
  distance?: number; // 米
}

async function amapGet(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const q = new URLSearchParams({ key: AMAP_KEY, ...params });
  const res = await fetch(`https://restapi.amap.com/v3/${path}?${q.toString()}`);
  const data = await res.json();
  if (data.status !== '1') throw new Error(data.info || '高德接口出错');
  return data;
}

// —— WGS-84(手机GPS) → GCJ-02(国内地图) 坐标纠偏 ——
// 国内地图法定加偏，不转换会漂移几百米。境外坐标原样返回。
const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function outOfChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}
function tLat(x: number, y: number): number {
  let r = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  r += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  r += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
  return r;
}
function tLng(x: number, y: number): number {
  let r = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  r += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  r += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  r += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
  return r;
}
export function wgs84ToGcj02(lat: number, lng: number): { lat: number; lng: number } {
  if (outOfChina(lat, lng)) return { lat, lng };
  let dLat = tLat(lng - 105.0, lat - 35.0);
  let dLng = tLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return { lat: lat + dLat, lng: lng + dLng };
}

// 取当前位置（已转成高德坐标系）
export function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('此设备不支持定位'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(wgs84ToGcj02(pos.coords.latitude, pos.coords.longitude)),
      (err) => reject(new Error(err.message || '定位失败')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

function toPlaces(pois: unknown): Place[] {
  if (!Array.isArray(pois)) return [];
  return pois
    .map((p: Record<string, unknown>) => ({
      name: typeof p.name === 'string' ? p.name : '',
      address: typeof p.address === 'string' ? p.address : undefined, // 高德空值给 []
      distance: typeof p.distance === 'string' && p.distance !== '' ? Number(p.distance) : undefined,
    }))
    .filter((p) => p.name);
}

// 周边地点（按距离排）+ 粗略区域「城市·区」
export async function nearbyPlaces(lat: number, lng: number): Promise<{ coarse: string; city: string; places: Place[] }> {
  const location = `${lng.toFixed(6)},${lat.toFixed(6)}`;
  const [re, around] = await Promise.all([
    amapGet('geocode/regeo', { location, extensions: 'base' }),
    amapGet('place/around', { location, radius: '1000', offset: '25', page: '1', sortrule: 'distance' }),
  ]);
  const regeocode = re.regeocode as Record<string, unknown> | undefined;
  const ac = (regeocode?.addressComponent ?? {}) as Record<string, unknown>;
  // 直辖市的 city 是空数组，退到 province
  const city = typeof ac.city === 'string' && ac.city ? ac.city : typeof ac.province === 'string' ? ac.province : '';
  const district = typeof ac.district === 'string' ? ac.district : '';
  const coarse = [city, district].filter(Boolean).join('·') || '当前位置';
  return { coarse, city, places: toPlaces((around as Record<string, unknown>).pois) };
}

// 关键字搜索（有城市就限定在城市内，模拟朋友圈的搜索）
export async function searchPlaces(keyword: string, city?: string): Promise<Place[]> {
  const params: Record<string, string> = { keywords: keyword, offset: '20', page: '1' };
  if (city) {
    params.city = city;
    params.citylimit = 'true';
  }
  const data = await amapGet('place/text', params);
  return toPlaces(data.pois);
}

export function formatDistance(m?: number): string {
  if (m == null || Number.isNaN(m)) return '';
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}
