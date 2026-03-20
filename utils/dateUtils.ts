import { format, parseISO } from 'date-fns';

export const formatDateZA = (dateString: string) => {
  if (!dateString) return 'N/A';
  try {
    // Handle 'yyyyMMddHHmmss' format
    if (/^\d{14}$/.test(dateString)) {
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      const hour = dateString.substring(8, 10);
      const min = dateString.substring(10, 12);
      const sec = dateString.substring(12, 14);
      return format(new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`), 'dd MMM yyyy HH:mm');
    }
    const date = parseISO(dateString);
    return format(date, 'dd MMM yyyy');
  } catch (e) {
    return dateString;
  }
};

export const formatDateTimeZA = (dateString: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return format(date, 'dd MMM yyyy HH:mm');
  } catch (e) {
    return dateString;
  }
};
