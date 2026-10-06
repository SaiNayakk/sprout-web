/** The text typed into the input an event came from. */
export function value(e: Event): string {
  return (e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
}

export function checked(e: Event): boolean {
  return (e.target as HTMLInputElement).checked;
}
