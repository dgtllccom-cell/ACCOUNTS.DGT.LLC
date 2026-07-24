export function numberToWords(amount: number): string {
  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = ["", "Thousand", "Million", "Billion", "Trillion"];

  if (amount === 0) return "Zero";

  const numString = amount.toFixed(2);
  const [integerPart, fractionalPart] = numString.split(".");

  let integerNumber = parseInt(integerPart, 10);
  let words = "";

  if (integerNumber < 0) {
    words = "Negative ";
    integerNumber = Math.abs(integerNumber);
  }

  let scaleIndex = 0;
  let integerWords = "";

  while (integerNumber > 0) {
    const chunk = integerNumber % 1000;
    if (chunk > 0) {
      integerWords = `${chunkToWords(chunk, units, teens, tens)} ${scales[scaleIndex]} ${integerWords}`;
    }
    integerNumber = Math.floor(integerNumber / 1000);
    scaleIndex++;
  }

  words += integerWords.trim();

  if (parseInt(fractionalPart, 10) > 0) {
    const fracNumber = parseInt(fractionalPart, 10);
    words += ` and ${chunkToWords(fracNumber, units, teens, tens)} Cents`;
  }

  return words.trim() + " Only";
}

function chunkToWords(num: number, units: string[], teens: string[], tens: string[]): string {
  let words = "";
  if (num > 99) {
    words += `${units[Math.floor(num / 100)]} Hundred `;
    num %= 100;
  }
  if (num > 9 && num < 20) {
    words += `${teens[num - 10]} `;
  } else {
    if (num >= 20) {
      words += `${tens[Math.floor(num / 10)]} `;
      num %= 10;
    }
    if (num > 0) {
      words += `${units[num]} `;
    }
  }
  return words.trim();
}
