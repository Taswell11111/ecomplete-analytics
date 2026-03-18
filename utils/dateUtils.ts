import { format, parseISO } from 'date-fns';

export const formatDateZA = (dateString: string) => {
  if (!dateString) return 'N/A';
  try {
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
