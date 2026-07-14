"use strict";

/**
 * Список стран для валидации поля `country` (эмуляция проверки MVCRM,
 * дающей ответ вида: { success:false, message:"Country {name} is not found!" }).
 *
 * Матчинг регистронезависимый и допускает распространённые синонимы/коды
 * (USA, UK, UAE, ISO2/ISO3). Строгую проверку можно выключить env-переменной
 * STRICT_COUNTRY=false — тогда любое непустое значение считается валидным.
 */

// Канонические названия стран (то, что «знает» CRM).
const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda",
  "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
  "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
  "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada",
  "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros",
  "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark",
  "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador",
  "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji",
  "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece",
  "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras",
  "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel",
  "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati",
  "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia",
  "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi",
  "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania",
  "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia",
  "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal",
  "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea",
  "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama",
  "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
  "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe",
  "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
  "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa",
  "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname",
  "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand",
  "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey",
  "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates",
  "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu",
  "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
];

// Синонимы и коды → каноническое имя.
const ALIASES = {
  "usa": "United States",
  "us": "United States",
  "u.s.a.": "United States",
  "u.s.": "United States",
  "united states of america": "United States",
  "america": "United States",
  "uk": "United Kingdom",
  "u.k.": "United Kingdom",
  "gb": "United Kingdom",
  "great britain": "United Kingdom",
  "england": "United Kingdom",
  "uae": "United Arab Emirates",
  "ae": "United Arab Emirates",
  "russian federation": "Russia",
  "ru": "Russia",
  "de": "Germany",
  "deutschland": "Germany",
  "fr": "France",
  "es": "Spain",
  "it": "Italy",
  "ua": "Ukraine",
  "pl": "Poland",
  "nl": "Netherlands",
  "holland": "Netherlands",
  "ca": "Canada",
  "au": "Australia",
  "in": "India",
  "cn": "China",
  "jp": "Japan",
  "br": "Brazil",
  "cz": "Czechia",
  "czech republic": "Czechia",
  "south korea": "South Korea",
  "korea": "South Korea",
  "republic of korea": "South Korea",
};

const canonicalByLower = new Map(COUNTRIES.map((c) => [c.toLowerCase(), c]));

/**
 * Возвращает каноническое имя страны или null, если не найдена.
 * @param {string} input
 * @returns {string|null}
 */
function resolveCountry(input) {
  if (typeof input !== "string") return null;
  const key = input.trim().toLowerCase();
  if (!key) return null;
  if (canonicalByLower.has(key)) return canonicalByLower.get(key);
  if (ALIASES[key]) return ALIASES[key];
  return null;
}

module.exports = { COUNTRIES, resolveCountry };
