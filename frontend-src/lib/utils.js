import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (value) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
};

export const formatDate = (dateString) => {
  if (!dateString) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateString));
};

export const formatDateTime = (dateString) => {
  if (!dateString) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
};

export const formatPhone = (phone) => {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

export const getWhatsAppLink = (phone, message = "") => {
  const cleaned = phone?.replace(/\D/g, "") || "";
  const fullNumber = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
  return `https://wa.me/${fullNumber}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
};

export const statusLabels = {
  received: "Recebido",
  analysis: "Em Análise",
  awaiting_approval: "Aguardando Aprovação",
  awaiting_part: "Aguardando Peça",
  in_repair: "Em Reparo",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export const statusColors = {
  received: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  analysis: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  awaiting_approval: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  awaiting_part: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  in_repair: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  cancelled: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
};

export const deviceTypeLabels = {
  cellphone: "Celular",
  notebook: "Notebook",
  tv: "TV",
  tablet: "Tablet",
  desktop: "Desktop",
  other: "Outro",
};

export const paymentMethodLabels = {
  cash: "Dinheiro",
  pix: "PIX",
  card: "Cartão",
  transfer: "Transferência",
};
