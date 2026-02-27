import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/pt-br';

dayjs.extend(relativeTime);
dayjs.locale('pt-br');

export function formatDate(date: string | Date): string {
  return dayjs(date).format('DD/MMM/YYYY');
}

export function formatDateTime(date: string | Date): string {
  return dayjs(date).format('DD/MMM/YYYY HH:mm');
}

export function formatRelativeTime(date: string | Date): string {
  return dayjs(date).fromNow();
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatTemperature(value: number): string {
  return `${value.toFixed(1)}°C`;
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(0)}%`;
}

export function formatArea(value: number): string {
  return `${formatNumber(value, 1)} ha`;
}

export function getTemperatureColor(value: number): string {
  if (value > 35) return '#dc3545';
  if (value > 32) return '#ffc107';
  return '#ff8a65';
}

export function getHumidityColor(value: number): string {
  if (value < 30) return '#ffc107';
  return '#4fc3f7';
}

export function getSoilMoistureColor(value: number): string {
  if (value < 25) return '#dc3545';
  if (value < 35) return '#ffc107';
  return '#66bb6a';
}
