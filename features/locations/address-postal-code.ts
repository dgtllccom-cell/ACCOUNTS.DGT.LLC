/**
 * A selected city's suggested code can be replaced or cleared with the city.
 * Codes entered by a person (including saved legacy data) must be kept.
 */
export function postalCodeAfterCityChange(
  value: string, previousSuggestion: string, nextSuggestion?: string | null,
): { value: string; suggestion: string } {
  if (value && value !== previousSuggestion) return { value, suggestion: "" };
  const suggestion = nextSuggestion ?? "";
  return { value: suggestion, suggestion };
}
