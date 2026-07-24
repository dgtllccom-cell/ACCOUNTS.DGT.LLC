export type LocationMasterArea = {
  name: string;
  code: string;
  postalCode?: string;
  phoneAreaCode?: string;
};

export type LocationMasterCity = {
  name: string;
  code: string;
  postalCode?: string;
  phoneAreaCode?: string;
  tehsils?: LocationMasterArea[];
};

export type LocationMasterDistrict = {
  name: string;
  code: string;
  postalCode?: string;
  phoneAreaCode?: string;
  cities: LocationMasterCity[];
};

export type LocationMasterState = {
  name: string;
  code: string;
  postalCode?: string;
  phoneAreaCode?: string;
  districts: LocationMasterDistrict[];
};

export type LocationMasterCountry = {
  name: string;
  iso2: string;
  iso3: string;
  currencyCode: string;
  phoneCode: string;
  states: LocationMasterState[];
};

export const LOCATION_MASTER_COUNTRIES: LocationMasterCountry[] = [
  {
    name: "Pakistan",
    iso2: "PK",
    iso3: "PAK",
    currencyCode: "PKR",
    phoneCode: "+92",
    states: [
      {
        name: "Punjab",
        code: "PK-PB",
        districts: [
          {
            name: "Lahore",
            code: "PK-PB-LHR",
            postalCode: "54000",
            phoneAreaCode: "042",
            cities: [
              { name: "Lahore", code: "PK-PB-LHR", postalCode: "54000", phoneAreaCode: "042", tehsils: [{ name: "Model Town", code: "PK-PB-LHR-MT", postalCode: "54700", phoneAreaCode: "042" }, { name: "Raiwind", code: "PK-PB-LHR-RWD", postalCode: "55150", phoneAreaCode: "042" }] }
            ]
          },
          {
            name: "Faisalabad",
            code: "PK-PB-FSD",
            postalCode: "38000",
            phoneAreaCode: "041",
            cities: [{ name: "Faisalabad", code: "PK-PB-FSD", postalCode: "38000", phoneAreaCode: "041", tehsils: [{ name: "Jaranwala", code: "PK-PB-FSD-JRW", postalCode: "37250", phoneAreaCode: "041" }] }]
          },
          {
            name: "Rawalpindi",
            code: "PK-PB-RWP",
            postalCode: "46000",
            phoneAreaCode: "051",
            cities: [{ name: "Rawalpindi", code: "PK-PB-RWP", postalCode: "46000", phoneAreaCode: "051", tehsils: [{ name: "Taxila", code: "PK-PB-RWP-TXL", postalCode: "47080", phoneAreaCode: "051" }] }]
          }
        ]
      },
      {
        name: "Sindh",
        code: "PK-SD",
        districts: [
          { name: "Karachi", code: "PK-SD-KHI", postalCode: "74000", phoneAreaCode: "021", cities: [{ name: "Karachi", code: "PK-SD-KHI", postalCode: "74000", phoneAreaCode: "021", tehsils: [{ name: "Saddar", code: "PK-SD-KHI-SDR", postalCode: "74400", phoneAreaCode: "021" }, { name: "Clifton", code: "PK-SD-KHI-CLF", postalCode: "75600", phoneAreaCode: "021" }] }] },
          { name: "Hyderabad", code: "PK-SD-HYD", postalCode: "71000", phoneAreaCode: "022", cities: [{ name: "Hyderabad", code: "PK-SD-HYD", postalCode: "71000", phoneAreaCode: "022" }] }
        ]
      },
      {
        name: "Balochistan",
        code: "PK-BA",
        districts: [
          { name: "Quetta", code: "PK-BA-QTA", postalCode: "87300", phoneAreaCode: "081", cities: [{ name: "Quetta", code: "PK-BA-QTA", postalCode: "87300", phoneAreaCode: "081" }] },
          { name: "Chaman", code: "PK-BA-CHM", postalCode: "86000", phoneAreaCode: "0826", cities: [{ name: "Chaman", code: "PK-BA-CHM", postalCode: "86000", phoneAreaCode: "0826", tehsils: [{ name: "Chaman Sadar", code: "PK-BA-CHM-SDR", postalCode: "86000", phoneAreaCode: "0826" }] }] }
        ]
      },
      {
        name: "Khyber Pakhtunkhwa",
        code: "PK-KP",
        districts: [
          { name: "Peshawar", code: "PK-KP-PEW", postalCode: "25000", phoneAreaCode: "091", cities: [{ name: "Peshawar", code: "PK-KP-PEW", postalCode: "25000", phoneAreaCode: "091" }] }
        ]
      },
      {
        name: "Islamabad Capital Territory",
        code: "PK-IS",
        districts: [
          { name: "Islamabad", code: "PK-IS-ISB", postalCode: "44000", phoneAreaCode: "051", cities: [{ name: "Islamabad", code: "PK-IS-ISB", postalCode: "44000", phoneAreaCode: "051" }] }
        ]
      }
    ]
  },
  {
    name: "Afghanistan",
    iso2: "AF",
    iso3: "AFG",
    currencyCode: "AFN",
    phoneCode: "+93",
    states: [
      { name: "Kabul", code: "AF-KBL", districts: [{ name: "Kabul", code: "AF-KBL-KBL", postalCode: "1001", phoneAreaCode: "020", cities: [{ name: "Kabul", code: "AF-KBL-KBL", postalCode: "1001", phoneAreaCode: "020", tehsils: [{ name: "District 1", code: "AF-KBL-KBL-D01", postalCode: "1001", phoneAreaCode: "020" }] }] }] },
      { name: "Kandahar", code: "AF-KDH", districts: [{ name: "Kandahar", code: "AF-KDH-KDH", postalCode: "3801", phoneAreaCode: "030", cities: [{ name: "Kandahar", code: "AF-KDH-KDH", postalCode: "3801", phoneAreaCode: "030" }] }] },
      { name: "Herat", code: "AF-HRT", districts: [{ name: "Herat", code: "AF-HRT-HRT", postalCode: "3001", phoneAreaCode: "040", cities: [{ name: "Herat", code: "AF-HRT-HRT", postalCode: "3001", phoneAreaCode: "040" }] }] },
      { name: "Balkh", code: "AF-BAL", districts: [{ name: "Mazar-i-Sharif", code: "AF-BAL-MZR", postalCode: "1701", phoneAreaCode: "050", cities: [{ name: "Mazar-i-Sharif", code: "AF-BAL-MZR", postalCode: "1701", phoneAreaCode: "050" }] }] },
      { name: "Nangarhar", code: "AF-NGR", districts: [{ name: "Jalalabad", code: "AF-NGR-JAA", postalCode: "2601", phoneAreaCode: "060", cities: [{ name: "Jalalabad", code: "AF-NGR-JAA", postalCode: "2601", phoneAreaCode: "060" }] }] }
    ]
  },
  {
    name: "India",
    iso2: "IN",
    iso3: "IND",
    currencyCode: "INR",
    phoneCode: "+91",
    states: [
      { name: "Maharashtra", code: "IN-MH", districts: [{ name: "Mumbai", code: "IN-MH-MUM", postalCode: "400001", phoneAreaCode: "022", cities: [{ name: "Mumbai", code: "IN-MH-MUM", postalCode: "400001", phoneAreaCode: "022" }] }, { name: "Pune", code: "IN-MH-PUN", postalCode: "411001", phoneAreaCode: "020", cities: [{ name: "Pune", code: "IN-MH-PUN", postalCode: "411001", phoneAreaCode: "020" }] }] },
      { name: "Delhi", code: "IN-DL", districts: [{ name: "New Delhi", code: "IN-DL-NDL", postalCode: "110001", phoneAreaCode: "011", cities: [{ name: "New Delhi", code: "IN-DL-NDL", postalCode: "110001", phoneAreaCode: "011" }] }] },
      { name: "Gujarat", code: "IN-GJ", districts: [{ name: "Ahmedabad", code: "IN-GJ-AMD", postalCode: "380001", phoneAreaCode: "079", cities: [{ name: "Ahmedabad", code: "IN-GJ-AMD", postalCode: "380001", phoneAreaCode: "079" }] }] },
      { name: "Punjab", code: "IN-PB", districts: [{ name: "Amritsar", code: "IN-PB-ATQ", postalCode: "143001", phoneAreaCode: "0183", cities: [{ name: "Amritsar", code: "IN-PB-ATQ", postalCode: "143001", phoneAreaCode: "0183" }] }] },
      { name: "Rajasthan", code: "IN-RJ", districts: [{ name: "Jaipur", code: "IN-RJ-JAI", postalCode: "302001", phoneAreaCode: "0141", cities: [{ name: "Jaipur", code: "IN-RJ-JAI", postalCode: "302001", phoneAreaCode: "0141" }] }] }
    ]
  },
  {
    name: "Iran",
    iso2: "IR",
    iso3: "IRN",
    currencyCode: "IRR",
    phoneCode: "+98",
    states: [
      { name: "Tehran", code: "IR-THR", districts: [{ name: "Tehran", code: "IR-THR-THR", postalCode: "11369", phoneAreaCode: "021", cities: [{ name: "Tehran", code: "IR-THR-THR", postalCode: "11369", phoneAreaCode: "021" }] }] },
      { name: "Razavi Khorasan", code: "IR-RKH", districts: [{ name: "Mashhad", code: "IR-RKH-MHD", postalCode: "91375", phoneAreaCode: "051", cities: [{ name: "Mashhad", code: "IR-RKH-MHD", postalCode: "91375", phoneAreaCode: "051" }] }] },
      { name: "Isfahan", code: "IR-ISF", districts: [{ name: "Isfahan", code: "IR-ISF-ISF", postalCode: "81464", phoneAreaCode: "031", cities: [{ name: "Isfahan", code: "IR-ISF-ISF", postalCode: "81464", phoneAreaCode: "031" }] }] },
      { name: "Fars", code: "IR-FRS", districts: [{ name: "Shiraz", code: "IR-FRS-SYZ", postalCode: "71345", phoneAreaCode: "071", cities: [{ name: "Shiraz", code: "IR-FRS-SYZ", postalCode: "71345", phoneAreaCode: "071" }] }] },
      { name: "East Azerbaijan", code: "IR-EAZ", districts: [{ name: "Tabriz", code: "IR-EAZ-TBZ", postalCode: "51368", phoneAreaCode: "041", cities: [{ name: "Tabriz", code: "IR-EAZ-TBZ", postalCode: "51368", phoneAreaCode: "041" }] }] }
    ]
  },
  {
    name: "United Arab Emirates",
    iso2: "AE",
    iso3: "ARE",
    currencyCode: "AED",
    phoneCode: "+971",
    states: [
      { name: "Dubai", code: "AE-DU", districts: [{ name: "Dubai", code: "AE-DU-DXB", postalCode: "00000", phoneAreaCode: "04", cities: [{ name: "Dubai", code: "AE-DU-DXB", postalCode: "00000", phoneAreaCode: "04", tehsils: [{ name: "Deira", code: "AE-DU-DXB-DEI", postalCode: "00000", phoneAreaCode: "04" }, { name: "Bur Dubai", code: "AE-DU-DXB-BUR", postalCode: "00000", phoneAreaCode: "04" }, { name: "Business Bay", code: "AE-DU-DXB-BB", postalCode: "00000", phoneAreaCode: "04" }, { name: "Dubai Marina", code: "AE-DU-DXB-DM", postalCode: "00000", phoneAreaCode: "04" }] }] }] },
      { name: "Abu Dhabi", code: "AE-AZ", districts: [{ name: "Abu Dhabi", code: "AE-AZ-AUH", postalCode: "00000", phoneAreaCode: "02", cities: [{ name: "Abu Dhabi City", code: "AE-AZ-AUH", postalCode: "00000", phoneAreaCode: "02" }, { name: "Al Ain", code: "AE-AZ-AAN", postalCode: "00000", phoneAreaCode: "03" }] }] },
      { name: "Sharjah", code: "AE-SH", districts: [{ name: "Sharjah", code: "AE-SH-SHJ", postalCode: "00000", phoneAreaCode: "06", cities: [{ name: "Sharjah City", code: "AE-SH-SHJ", postalCode: "00000", phoneAreaCode: "06", tehsils: [{ name: "Al Nahda", code: "AE-SH-SHJ-NAH", postalCode: "00000", phoneAreaCode: "06" }, { name: "Al Majaz", code: "AE-SH-SHJ-MJZ", postalCode: "00000", phoneAreaCode: "06" }] }] }] },
      { name: "Ajman", code: "AE-AJ", districts: [{ name: "Ajman", code: "AE-AJ-AJM", postalCode: "00000", phoneAreaCode: "06", cities: [{ name: "Ajman City", code: "AE-AJ-AJM", postalCode: "00000", phoneAreaCode: "06" }] }] },
      { name: "Ras Al Khaimah", code: "AE-RK", districts: [{ name: "Ras Al Khaimah", code: "AE-RK-RKT", postalCode: "00000", phoneAreaCode: "07", cities: [{ name: "Ras Al Khaimah City", code: "AE-RK-RKT", postalCode: "00000", phoneAreaCode: "07" }] }] },
      { name: "Fujairah", code: "AE-FU", districts: [{ name: "Fujairah", code: "AE-FU-FJR", postalCode: "00000", phoneAreaCode: "09", cities: [{ name: "Fujairah City", code: "AE-FU-FJR", postalCode: "00000", phoneAreaCode: "09" }] }] },
      { name: "Umm Al Quwain", code: "AE-UQ", districts: [{ name: "Umm Al Quwain", code: "AE-UQ-UAQ", postalCode: "00000", phoneAreaCode: "06", cities: [{ name: "Umm Al Quwain City", code: "AE-UQ-UAQ", postalCode: "00000", phoneAreaCode: "06" }] }] }
    ]
  }
];

export function findLocationMasterCountry(input: { name?: string | null; iso2?: string | null; iso3?: string | null }) {
  const name = input.name?.trim().toLowerCase();
  const iso2 = input.iso2?.trim().toUpperCase();
  const iso3 = input.iso3?.trim().toUpperCase();
  return LOCATION_MASTER_COUNTRIES.find((country) => {
    return country.name.toLowerCase() === name || country.iso2 === iso2 || country.iso3 === iso3;
  });
}
