const DIGITS = '০১২৩৪৫৬৭৮৯';

/** Western digits → Bangla digits. */
export const bn = (n) => String(n).replace(/\d/g, (d) => DIGITS[d]);

export const MONTHS = [
	'জানুয়ারি',
	'ফেব্রুয়ারি',
	'মার্চ',
	'এপ্রিল',
	'মে',
	'জুন',
	'জুলাই',
	'আগস্ট',
	'সেপ্টেম্বর',
	'অক্টোবর',
	'নভেম্বর',
	'ডিসেম্বর'
];
export const WEEKDAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

/** start = [year, monthIndex, day]; returns the date `offset` days later. */
export function dateOf(start, offset) {
	const d = new Date(start[0], start[1], start[2]);
	d.setDate(d.getDate() + offset);
	return d;
}

/** "৯ নভেম্বর ২০২৫, রবিবার" */
export const fmtDate = (d) =>
	`${bn(d.getDate())} ${MONTHS[d.getMonth()]} ${bn(d.getFullYear())}, ${WEEKDAYS[d.getDay()]}`;

export const prefersReducedMotion = () =>
	typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
