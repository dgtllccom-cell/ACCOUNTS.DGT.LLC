import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { requireErpSession } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

type CityInput = { name: string; code: string; zip?: string; phone?: string };
type DistrictInput = { name: string; code: string; cities: CityInput[] };
type StateInput = { name: string; code: string; districts: DistrictInput[] };
type CountryData = {
  name: string;
  iso2: string;
  iso3: string;
  currency: string;
  phone: string;
  states: StateInput[];
};

const OFFICIAL_LOCATIONS_DATA: CountryData[] = [
  {
    name: "Pakistan",
    iso2: "PK",
    iso3: "PAK",
    currency: "PKR",
    phone: "+92",
    states: [
      {
        name: "Punjab",
        code: "PK-PB",
        districts: [
          {
            name: "Lahore",
            code: "PK-PB-LHR",
            cities: [
              { name: "Lahore", code: "LHR", zip: "54000", phone: "042" },
              { name: "Model Town", code: "PK-PB-MTN", zip: "54700", phone: "042" },
              { name: "Raiwind", code: "PK-PB-RWD", zip: "55150", phone: "042" },
              { name: "Gulberg Lahore", code: "PK-PB-GLB", zip: "54660", phone: "042" },
              { name: "Cantonment Lahore", code: "PK-PB-LCT", zip: "54810", phone: "042" }
            ]
          },
          {
            name: "Faisalabad",
            code: "PK-PB-FSD",
            cities: [
              { name: "Faisalabad", code: "FSD", zip: "38000", phone: "041" },
              { name: "Jaranwala", code: "PK-PB-JNW", zip: "37200", phone: "041" },
              { name: "Samundri", code: "PK-PB-SMD", zip: "37300", phone: "041" },
              { name: "Tandlianwala", code: "PK-PB-TDW", zip: "37100", phone: "041" }
            ]
          },
          {
            name: "Rawalpindi",
            code: "PK-PB-RWP",
            cities: [
              { name: "Rawalpindi", code: "RWP", zip: "46000", phone: "051" },
              { name: "Taxila", code: "PK-PB-TXL", zip: "47080", phone: "051" },
              { name: "Gujar Khan", code: "PK-PB-GJK", zip: "47800", phone: "051" },
              { name: "Kahuta", code: "PK-PB-KHT", zip: "47300", phone: "051" }
            ]
          },
          {
            name: "Multan",
            code: "PK-PB-MUX",
            cities: [
              { name: "Multan", code: "MUX", zip: "60000", phone: "061" },
              { name: "Shujabad", code: "PK-PB-SJB", zip: "60600", phone: "061" },
              { name: "Jalalpur Pirwala", code: "PK-PB-JPP", zip: "60500", phone: "061" }
            ]
          },
          {
            name: "Gujranwala",
            code: "PK-PB-GJR",
            cities: [
              { name: "Gujranwala", code: "GJR", zip: "52250", phone: "055" },
              { name: "Kamoke", code: "PK-PB-KMK", zip: "52470", phone: "055" },
              { name: "Nowshera Virkan", code: "PK-PB-NWV", zip: "52600", phone: "055" }
            ]
          },
          {
            name: "Sialkot",
            code: "PK-PB-SKT",
            cities: [
              { name: "Sialkot", code: "SKT", zip: "51310", phone: "052" },
              { name: "Daska", code: "PK-PB-DSK", zip: "51010", phone: "052" },
              { name: "Pasrur", code: "PK-PB-PSR", zip: "51480", phone: "052" },
              { name: "Sambrial", code: "PK-PB-SMB", zip: "51330", phone: "052" }
            ]
          },
          {
            name: "Sargodha",
            code: "PK-PB-SGD",
            cities: [
              { name: "Sargodha", code: "SGD", zip: "40100", phone: "048" },
              { name: "Bhalwal", code: "PK-PB-BWL", zip: "40400", phone: "048" },
              { name: "Shahpur", code: "PK-PB-SHP", zip: "40200", phone: "048" }
            ]
          },
          {
            name: "Bahawalpur",
            code: "PK-PB-BWP",
            cities: [
              { name: "Bahawalpur", code: "BWP", zip: "63100", phone: "062" },
              { name: "Ahmedpur East", code: "PK-PB-APE", zip: "63350", phone: "062" },
              { name: "Yazman", code: "PK-PB-YZM", zip: "63250", phone: "062" }
            ]
          },
          {
            name: "Sheikhupura",
            code: "PK-PB-SKP",
            cities: [
              { name: "Sheikhupura", code: "SKP", zip: "39350", phone: "056" },
              { name: "Ferozewala", code: "PK-PB-FRZ", zip: "39020", phone: "056" },
              { name: "Muridke", code: "PK-PB-MRK", zip: "39010", phone: "056" }
            ]
          },
          {
            name: "Rahim Yar Khan",
            code: "PK-PB-RYK",
            cities: [
              { name: "Rahim Yar Khan", code: "RYK", zip: "64200", phone: "068" },
              { name: "Sadiqabad", code: "PK-PB-SQB", zip: "64300", phone: "068" },
              { name: "Khanpur", code: "PK-PB-KNP", zip: "64100", phone: "068" }
            ]
          },
          {
            name: "Jhang",
            code: "PK-PB-JHG",
            cities: [
              { name: "Jhang", code: "JHG", zip: "35200", phone: "047" },
              { name: "Shorkot", code: "PK-PB-SKT2", zip: "35050", phone: "047" },
              { name: "Ahmadpur Sial", code: "PK-PB-APS", zip: "35020", phone: "047" }
            ]
          },
          {
            name: "Dera Ghazi Khan",
            code: "PK-PB-DGK",
            cities: [
              { name: "Dera Ghazi Khan", code: "DGK", zip: "32200", phone: "064" },
              { name: "Taunsa", code: "PK-PB-TNS", zip: "32900", phone: "064" },
              { name: "Kot Chutta", code: "PK-PB-KTC", zip: "32300", phone: "064" }
            ]
          },
          {
            name: "Gujrat",
            code: "PK-PB-GJT",
            cities: [
              { name: "Gujrat", code: "GJT", zip: "50700", phone: "053" },
              { name: "Kharian", code: "PK-PB-KRN", zip: "50900", phone: "053" },
              { name: "Sarai Alamgir", code: "PK-PB-SAG", zip: "50950", phone: "053" }
            ]
          },
          {
            name: "Sahiwal",
            code: "PK-PB-SWL",
            cities: [
              { name: "Sahiwal", code: "SWL", zip: "57000", phone: "040" },
              { name: "Chichawatni", code: "PK-PB-CWT", zip: "57200", phone: "040" }
            ]
          },
          {
            name: "Kasur",
            code: "PK-PB-KSR",
            cities: [
              { name: "Kasur", code: "KSR", zip: "55050", phone: "049" },
              { name: "Chunian", code: "PK-PB-CHN2", zip: "55300", phone: "049" },
              { name: "Pattoki", code: "PK-PB-PTK", zip: "55500", phone: "049" },
              { name: "Kot Radha Kishan", code: "PK-PB-KRK", zip: "55170", phone: "049" }
            ]
          },
          {
            name: "Okara",
            code: "PK-PB-OKR",
            cities: [
              { name: "Okara", code: "OKR", zip: "56300", phone: "044" },
              { name: "Renala Khurd", code: "PK-PB-RNK", zip: "56210", phone: "044" },
              { name: "Depalpur", code: "PK-PB-DPL", zip: "56180", phone: "044" }
            ]
          },
          {
            name: "Chiniot",
            code: "PK-PB-CHN",
            cities: [
              { name: "Chiniot", code: "CHN", zip: "35400", phone: "047" },
              { name: "Lalian", code: "PK-PB-LLN", zip: "35410", phone: "047" },
              { name: "Bhawana", code: "PK-PB-BWN2", zip: "35440", phone: "047" }
            ]
          },
          {
            name: "Attock",
            code: "PK-PB-ATK",
            cities: [
              { name: "Attock", code: "ATK", zip: "43600", phone: "057" },
              { name: "Fateh Jang", code: "PK-PB-FTJ", zip: "43350", phone: "057" },
              { name: "Hassan Abdal", code: "PK-PB-HAB", zip: "43700", phone: "057" },
              { name: "Pindi Gheb", code: "PK-PB-PGB", zip: "43200", phone: "057" }
            ]
          },
          {
            name: "Jhelum",
            code: "PK-PB-JHM",
            cities: [
              { name: "Jhelum", code: "JHM", zip: "49600", phone: "0544" },
              { name: "Pind Dadan Khan", code: "PK-PB-PDK", zip: "49040", phone: "0544" },
              { name: "Sohawa", code: "PK-PB-SHW", zip: "49300", phone: "0544" }
            ]
          },
          {
            name: "Chakwal",
            code: "PK-PB-CKW",
            cities: [
              { name: "Chakwal", code: "CKW", zip: "48800", phone: "0543" },
              { name: "Choa Saidan Shah", code: "PK-PB-CSS", zip: "48320", phone: "0543" },
              { name: "Kalar Kahar", code: "PK-PB-KKH", zip: "48530", phone: "0543" }
            ]
          },
          {
            name: "Muzaffargarh",
            code: "PK-PB-MZG",
            cities: [
              { name: "Muzaffargarh", code: "MZG", zip: "34700", phone: "066" },
              { name: "Alipur", code: "PK-PB-ALP", zip: "34900", phone: "066" },
              { name: "Jatoi", code: "PK-PB-JTI", zip: "34800", phone: "066" },
              { name: "Kot Addu", code: "PK-PB-KAD", zip: "34050", phone: "066" }
            ]
          },
          {
            name: "Mianwali",
            code: "PK-PB-MWL",
            cities: [
              { name: "Mianwali", code: "MWL", zip: "42200", phone: "0459" },
              { name: "Isa Khel", code: "PK-PB-IKL", zip: "42300", phone: "0459" },
              { name: "Piplan", code: "PK-PB-PPL", zip: "42100", phone: "0459" }
            ]
          },
          {
            name: "Bhakkar",
            code: "PK-PB-BKR",
            cities: [
              { name: "Bhakkar", code: "BKR", zip: "30000", phone: "0453" },
              { name: "Darya Khan", code: "PK-PB-DYK", zip: "30100", phone: "0453" },
              { name: "Kallur Kot", code: "PK-PB-KLK", zip: "30200", phone: "0453" }
            ]
          },
          {
            name: "Layyah",
            code: "PK-PB-LYH",
            cities: [
              { name: "Layyah", code: "LYH", zip: "31200", phone: "0606" },
              { name: "Choubara", code: "PK-PB-CBR", zip: "31100", phone: "0606" },
              { name: "Karor Lal Esan", code: "PK-PB-KLE", zip: "31300", phone: "0606" }
            ]
          },
          {
            name: "Khanewal",
            code: "PK-PB-KWL",
            cities: [
              { name: "Khanewal", code: "KWL", zip: "58150", phone: "065" },
              { name: "Kabirwala", code: "PK-PB-KBW", zip: "58250", phone: "065" },
              { name: "Mian Channu", code: "PK-PB-MNC", zip: "58000", phone: "065" }
            ]
          },
          {
            name: "Vehari",
            code: "PK-PB-VHR",
            cities: [
              { name: "Vehari", code: "VHR", zip: "61100", phone: "067" },
              { name: "Burewala", code: "PK-PB-BWL2", zip: "61010", phone: "067" },
              { name: "Mailsi", code: "PK-PB-MLS", zip: "61200", phone: "067" }
            ]
          },
          {
            name: "Mandi Bahauddin",
            code: "PK-PB-MBD",
            cities: [
              { name: "Mandi Bahauddin", code: "MBD", zip: "50400", phone: "0546" },
              { name: "Phalia", code: "PK-PB-PHL", zip: "50430", phone: "0546" },
              { name: "Malakwal", code: "PK-PB-MLK", zip: "50460", phone: "0546" }
            ]
          },
          {
            name: "Narowal",
            code: "PK-PB-NRW",
            cities: [
              { name: "Narowal", code: "NRW", zip: "51600", phone: "0542" },
              { name: "Shakargarh", code: "PK-PB-SKG", zip: "51670", phone: "0542" },
              { name: "Zafarwal", code: "PK-PB-ZFW", zip: "51620", phone: "0542" }
            ]
          },
          {
            name: "Pakpattan",
            code: "PK-PB-PKP",
            cities: [
              { name: "Pakpattan", code: "PKP", zip: "57400", phone: "0457" },
              { name: "Arifwala", code: "PK-PB-AFW", zip: "57150", phone: "0457" }
            ]
          },
          {
            name: "Rajanpur",
            code: "PK-PB-RJP",
            cities: [
              { name: "Rajanpur", code: "RJP", zip: "33500", phone: "0604" },
              { name: "Jampur", code: "PK-PB-JMP", zip: "33400", phone: "0604" },
              { name: "Rojhan", code: "PK-PB-RJN", zip: "33600", phone: "0604" }
            ]
          },
          {
            name: "Toba Tek Singh",
            code: "PK-PB-TTS",
            cities: [
              { name: "Toba Tek Singh", code: "TTS", zip: "36050", phone: "046" },
              { name: "Gojra", code: "PK-PB-GJR2", zip: "36100", phone: "046" },
              { name: "Kamalia", code: "PK-PB-KML", zip: "36300", phone: "046" }
            ]
          },
          {
            name: "Bahawalnagar",
            code: "PK-PB-BWN",
            cities: [
              { name: "Bahawalnagar", code: "BWN", zip: "62300", phone: "063" },
              { name: "Chishtian", code: "PK-PB-CST", zip: "62350", phone: "063" },
              { name: "Fort Abbas", code: "PK-PB-FAB", zip: "62020", phone: "063" }
            ]
          },
          {
            name: "Lodhran",
            code: "PK-PB-LDN",
            cities: [
              { name: "Lodhran", code: "LDN", zip: "59320", phone: "0608" },
              { name: "Duniyapur", code: "PK-PB-DNP", zip: "59100", phone: "0608" },
              { name: "Kahror Pakka", code: "PK-PB-KRP", zip: "59200", phone: "0608" }
            ]
          },
          {
            name: "Hafizabad",
            code: "PK-PB-HFZ",
            cities: [
              { name: "Hafizabad", code: "HFZ", zip: "52110", phone: "0547" },
              { name: "Pindi Bhattian", code: "PK-PB-PBT", zip: "52180", phone: "0547" }
            ]
          },
          {
            name: "Nankana Sahib",
            code: "PK-PB-NKS",
            cities: [
              { name: "Nankana Sahib", code: "NKS", zip: "39100", phone: "056" },
              { name: "Shahkot", code: "PK-PB-SKT3", zip: "39630", phone: "056" },
              { name: "Sangla Hill", code: "PK-PB-SLH", zip: "39600", phone: "056" }
            ]
          }
        ]
      },
      {
        name: "Sindh",
        code: "PK-SD",
        districts: [
          {
            name: "Karachi Central",
            code: "PK-SD-KHC",
            cities: [
              { name: "Karachi Central", code: "KHC", zip: "74600", phone: "021" },
              { name: "North Nazimabad", code: "NNZ", zip: "74700", phone: "021" },
              { name: "Gulberg Karachi", code: "GBK", zip: "74630", phone: "021" },
              { name: "Liaquatabad", code: "LQT", zip: "74610", phone: "021" }
            ]
          },
          {
            name: "Karachi East",
            code: "PK-SD-KHE",
            cities: [
              { name: "Karachi East", code: "KHE", zip: "75300", phone: "021" },
              { name: "Gulshan-e-Iqbal", code: "GEI", zip: "75300", phone: "021" },
              { name: "Jamshed Town", code: "JMT", zip: "75400", phone: "021" }
            ]
          },
          {
            name: "Karachi South",
            code: "PK-SD-KHS",
            cities: [
              { name: "Karachi", code: "KHI", zip: "74000", phone: "021" },
              { name: "Saddar Karachi", code: "SDR", zip: "74400", phone: "021" },
              { name: "Clifton", code: "CFT", zip: "75600", phone: "021" },
              { name: "Lyari", code: "LYR", zip: "75660", phone: "021" }
            ]
          },
          {
            name: "Karachi West",
            code: "PK-SD-KHW",
            cities: [
              { name: "Karachi West", code: "KHW", zip: "75700", phone: "021" },
              { name: "Orangi", code: "ORG", zip: "75800", phone: "021" },
              { name: "SITE Town", code: "STE", zip: "75730", phone: "021" }
            ]
          },
          {
            name: "Korangi",
            code: "PK-SD-KRG",
            cities: [
              { name: "Korangi", code: "KRG", zip: "74900", phone: "021" },
              { name: "Landhi", code: "LND", zip: "75120", phone: "021" },
              { name: "Shah Faisal", code: "SFS", zip: "75230", phone: "021" }
            ]
          },
          {
            name: "Malir",
            code: "PK-SD-MLR",
            cities: [
              { name: "Malir", code: "MLR", zip: "75050", phone: "021" },
              { name: "Bin Qasim", code: "BQS", zip: "75020", phone: "021" },
              { name: "Gadap", code: "GDP", zip: "75340", phone: "021" }
            ]
          },
          {
            name: "Keamari",
            code: "PK-SD-KMR",
            cities: [
              { name: "Keamari", code: "KMR", zip: "75620", phone: "021" },
              { name: "Hawkesbay", code: "HWB", zip: "75750", phone: "021" }
            ]
          },
          {
            name: "Hyderabad",
            code: "PK-SD-HYD",
            cities: [
              { name: "Hyderabad", code: "HYD", zip: "71000", phone: "022" },
              { name: "Latifabad", code: "LTF", zip: "71800", phone: "022" },
              { name: "Qasimabad", code: "QSM", zip: "71500", phone: "022" }
            ]
          },
          {
            name: "Sukkur",
            code: "PK-SD-SKR",
            cities: [
              { name: "Sukkur", code: "SKR", zip: "65200", phone: "071" },
              { name: "Rohri", code: "RHR", zip: "65170", phone: "071" },
              { name: "Pano Akil", code: "PAK2", zip: "65110", phone: "071" }
            ]
          },
          {
            name: "Larkana",
            code: "PK-SD-LRK",
            cities: [
              { name: "Larkana", code: "LRK", zip: "77150", phone: "074" },
              { name: "Ratodero", code: "RTD", zip: "77180", phone: "074" },
              { name: "Dokri", code: "DKR", zip: "77040", phone: "074" }
            ]
          },
          {
            name: "Shaheed Benazirabad",
            code: "PK-SD-SBA",
            cities: [
              { name: "Nawabshah", code: "NWB", zip: "67450", phone: "0244" },
              { name: "Sakrand", code: "SKD2", zip: "67210", phone: "0244" },
              { name: "Daur", code: "DAR", zip: "67400", phone: "0244" }
            ]
          },
          {
            name: "Mirpur Khas",
            code: "PK-SD-MPK",
            cities: [
              { name: "Mirpur Khas", code: "MPK", zip: "69000", phone: "0233" },
              { name: "Digri", code: "DGR", zip: "69200", phone: "0233" },
              { name: "Kot Ghulam Muhammad", code: "KGM", zip: "69100", phone: "0233" }
            ]
          },
          {
            name: "Badin",
            code: "PK-SD-BDN",
            cities: [
              { name: "Badin", code: "BDN", zip: "72200", phone: "0297" },
              { name: "Matli", code: "MTL", zip: "72100", phone: "0297" },
              { name: "Tando Bago", code: "TBG", zip: "72300", phone: "0297" }
            ]
          },
          {
            name: "Thatta",
            code: "PK-SD-TTA",
            cities: [
              { name: "Thatta", code: "TTA", zip: "73130", phone: "0298" },
              { name: "Mirpur Sakro", code: "MSK", zip: "73210", phone: "0298" },
              { name: "Ghorabari", code: "GHB", zip: "73200", phone: "0298" }
            ]
          },
          {
            name: "Dadu",
            code: "PK-SD-DDU",
            cities: [
              { name: "Dadu", code: "DDU", zip: "76270", phone: "025" },
              { name: "Mehar", code: "MHR", zip: "76300", phone: "025" },
              { name: "Khairpur Nathan Shah", code: "KNS", zip: "76070", phone: "025" }
            ]
          },
          {
            name: "Shikarpur",
            code: "PK-SD-SKP2",
            cities: [
              { name: "Shikarpur", code: "SKP3", zip: "78100", phone: "0726" },
              { name: "Lakhi Ghulam Shah", code: "LGS", zip: "78120", phone: "0726" }
            ]
          },
          {
            name: "Jacobabad",
            code: "PK-SD-JCB",
            cities: [
              { name: "Jacobabad", code: "JCB", zip: "79000", phone: "0722" },
              { name: "Garhi Khairo", code: "GKH", zip: "79150", phone: "0722" }
            ]
          },
          {
            name: "Khairpur",
            code: "PK-SD-KHP",
            cities: [
              { name: "Khairpur", code: "KHP", zip: "66020", phone: "0243" },
              { name: "Gambat", code: "GBT", zip: "66010", phone: "0243" },
              { name: "Kingri", code: "KNG", zip: "66070", phone: "0243" }
            ]
          },
          {
            name: "Ghotki",
            code: "PK-SD-GTK",
            cities: [
              { name: "Ghotki", code: "GTK", zip: "65010", phone: "0723" },
              { name: "Mirpur Mathelo", code: "MMM", zip: "65020", phone: "0723" },
              { name: "Daharki", code: "DHK", zip: "65030", phone: "0723" }
            ]
          },
          {
            name: "Sanghar",
            code: "PK-SD-SNG",
            cities: [
              { name: "Sanghar", code: "SNG", zip: "68100", phone: "0235" },
              { name: "Tando Adam", code: "TDA", zip: "68060", phone: "0235" },
              { name: "Shahdadpur", code: "SDP", zip: "68030", phone: "0235" }
            ]
          },
          {
            name: "Tharparkar",
            code: "PK-SD-TPR",
            cities: [
              { name: "Mithi", code: "MTH", zip: "69230", phone: "0232" },
              { name: "Islamkot", code: "ISK", zip: "69240", phone: "0232" },
              { name: "Chachro", code: "CCR", zip: "69250", phone: "0232" }
            ]
          },
          {
            name: "Umerkot",
            code: "PK-SD-UMK",
            cities: [
              { name: "Umerkot", code: "UMK", zip: "69140", phone: "0238" },
              { name: "Pithoro", code: "PTH", zip: "69130", phone: "0238" },
              { name: "Kunri", code: "KNR", zip: "69160", phone: "0238" }
            ]
          }
        ]
      },
      {
        name: "Balochistan",
        code: "PK-BA",
        districts: [
          {
            name: "Quetta",
            code: "PK-BA-QTA",
            cities: [
              { name: "Quetta", code: "UET", zip: "87300", phone: "081" },
              { name: "Zarghoon", code: "ZRG", zip: "87310", phone: "081" },
              { name: "Chiltan", code: "CLT", zip: "87320", phone: "081" },
              { name: "Panjpai", code: "PJP", zip: "87330", phone: "081" }
            ]
          },
          {
            name: "Chaman",
            code: "PK-BA-CHM",
            cities: [
              { name: "Chaman", code: "CHM", zip: "86000", phone: "0826" },
              { name: "Chaman Sadar", code: "CMS", zip: "86010", phone: "0826" }
            ]
          },
          {
            name: "Pishin",
            code: "PK-BA-PSN",
            cities: [
              { name: "Pishin", code: "PSN", zip: "86200", phone: "0826" },
              { name: "Hurramzai", code: "HRM", zip: "86210", phone: "0826" },
              { name: "Karezat", code: "KRZ", zip: "86220", phone: "0826" }
            ]
          },
          {
            name: "Gwadar",
            code: "PK-BA-GWD",
            cities: [
              { name: "Gwadar", code: "GWD", zip: "91200", phone: "0864" },
              { name: "Pasni", code: "PSN2", zip: "91300", phone: "0864" },
              { name: "Ormara", code: "ORM", zip: "91400", phone: "0864" },
              { name: "Jiwani", code: "JWN", zip: "91100", phone: "0864" }
            ]
          },
          {
            name: "Khuzdar",
            code: "PK-BA-KZR",
            cities: [
              { name: "Khuzdar", code: "KZR", zip: "89100", phone: "0848" },
              { name: "Wadh", code: "WDH", zip: "89200", phone: "0848" },
              { name: "Zahri", code: "ZHR", zip: "89300", phone: "0848" }
            ]
          },
          {
            name: "Kech / Turbat",
            code: "PK-BA-TRB",
            cities: [
              { name: "Turbat", code: "TRB", zip: "92100", phone: "0852" },
              { name: "Tump", code: "TMP", zip: "92200", phone: "0852" },
              { name: "Buleda", code: "BLD", zip: "92300", phone: "0852" }
            ]
          },
          {
            name: "Zhob",
            code: "PK-BA-ZHB",
            cities: [
              { name: "Zhob", code: "ZHB", zip: "85200", phone: "0824" },
              { name: "Sambaza", code: "SMB2", zip: "85210", phone: "0824" }
            ]
          },
          {
            name: "Loralai",
            code: "PK-BA-LRL",
            cities: [
              { name: "Loralai", code: "LRL", zip: "84800", phone: "0824" },
              { name: "Bori", code: "BOR", zip: "84810", phone: "0824" }
            ]
          },
          {
            name: "Sibi",
            code: "PK-BA-SBI",
            cities: [
              { name: "Sibi", code: "SBI", zip: "82000", phone: "0833" },
              { name: "Lehri", code: "LHR2", zip: "82100", phone: "0833" }
            ]
          },
          {
            name: "Jaffarabad",
            code: "PK-BA-JFB",
            cities: [
              { name: "Dera Allah Yar", code: "DAY", zip: "80400", phone: "0838" },
              { name: "Usta Mohammad", code: "UMD", zip: "80500", phone: "0838" }
            ]
          },
          {
            name: "Nasirabad",
            code: "PK-BA-NSB",
            cities: [
              { name: "Dera Murad Jamali", code: "DMJ", zip: "80000", phone: "0838" },
              { name: "Chattar", code: "CTR", zip: "80100", phone: "0838" }
            ]
          },
          {
            name: "Nushki",
            code: "PK-BA-NSK",
            cities: [
              { name: "Nushki", code: "NSK", zip: "94000", phone: "0875" },
              { name: "Dak", code: "DAK", zip: "94010", phone: "0875" }
            ]
          },
          {
            name: "Chaghi",
            code: "PK-BA-CHG",
            cities: [
              { name: "Dalbandin", code: "DBD", zip: "94100", phone: "0875" },
              { name: "Taftan", code: "TFT", zip: "94200", phone: "0875" },
              { name: "Nok Kundi", code: "NKK", zip: "94300", phone: "0875" }
            ]
          },
          {
            name: "Kalat",
            code: "PK-BA-KLT",
            cities: [
              { name: "Kalat", code: "KLT", zip: "88300", phone: "0844" },
              { name: "Mangochar", code: "MGC", zip: "88310", phone: "0844" }
            ]
          },
          {
            name: "Mastung",
            code: "PK-BA-MST",
            cities: [
              { name: "Mastung", code: "MST", zip: "88200", phone: "0843" },
              { name: "Khad Kucha", code: "KDK", zip: "88210", phone: "0843" },
              { name: "Dasht Mastung", code: "DSM", zip: "88220", phone: "0843" }
            ]
          },
          {
            name: "Hub",
            code: "PK-BA-HUB",
            cities: [
              { name: "Hub", code: "HUB", zip: "90150", phone: "0853" },
              { name: "Dureji", code: "DRJ", zip: "90200", phone: "0853" },
              { name: "Gaddani", code: "GDN", zip: "90180", phone: "0853" }
            ]
          },
          {
            name: "Lasbela",
            code: "PK-BA-LSB",
            cities: [
              { name: "Uthal", code: "UTL", zip: "90100", phone: "0853" },
              { name: "Bela", code: "BEL", zip: "90250", phone: "0853" }
            ]
          },
          {
            name: "Panjgur",
            code: "PK-BA-PJG",
            cities: [
              { name: "Panjgur", code: "PJG", zip: "93000", phone: "0855" },
              { name: "Gowargo", code: "GWG", zip: "93100", phone: "0855" }
            ]
          },
          {
            name: "Qila Saifullah",
            code: "PK-BA-QSF",
            cities: [
              { name: "Qila Saifullah", code: "QSF", zip: "85100", phone: "0823" },
              { name: "Muslim Bagh", code: "MBG", zip: "85000", phone: "0823" }
            ]
          },
          {
            name: "Qila Abdullah",
            code: "PK-BA-QAB",
            cities: [
              { name: "Qila Abdullah", code: "QAB", zip: "86100", phone: "0826" },
              { name: "Gulistan", code: "GLS", zip: "86110", phone: "0826" }
            ]
          },
          {
            name: "Ziarat",
            code: "PK-BA-ZRT",
            cities: [
              { name: "Ziarat", code: "ZRT", zip: "85300", phone: "0833" },
              { name: "Sinjawi", code: "SNJ", zip: "85310", phone: "0833" }
            ]
          },
          {
            name: "Harnai",
            code: "PK-BA-HRN",
            cities: [
              { name: "Harnai", code: "HRN", zip: "84900", phone: "0833" },
              { name: "Shahrag", code: "SHG", zip: "84910", phone: "0833" }
            ]
          },
          {
            name: "Kohlu",
            code: "PK-BA-KHL",
            cities: [
              { name: "Kohlu", code: "KHL", zip: "83800", phone: "0829" },
              { name: "Mawand", code: "MWD", zip: "83810", phone: "0829" }
            ]
          },
          {
            name: "Dera Bugti",
            code: "PK-BA-DBG",
            cities: [
              { name: "Dera Bugti", code: "DBG", zip: "83500", phone: "0835" },
              { name: "Sui", code: "SUI", zip: "83600", phone: "0835" },
              { name: "Phelpagh", code: "PLP", zip: "83510", phone: "0835" }
            ]
          },
          {
            name: "Kharan",
            code: "PK-BA-KRN",
            cities: [
              { name: "Kharan", code: "KRN", zip: "95000", phone: "0847" },
              { name: "Sar-Kharan", code: "SKR2", zip: "95010", phone: "0847" }
            ]
          },
          {
            name: "Washuk",
            code: "PK-BA-WSK",
            cities: [
              { name: "Washuk", code: "WSK", zip: "95100", phone: "0847" },
              { name: "Nag", code: "NAG", zip: "95110", phone: "0847" },
              { name: "Besima", code: "BSM", zip: "95120", phone: "0847" }
            ]
          }
        ]
      },
      {
        name: "Khyber Pakhtunkhwa",
        code: "PK-KP",
        districts: [
          {
            name: "Peshawar",
            code: "PK-KP-PEW",
            cities: [
              { name: "Peshawar", code: "PEW", zip: "25000", phone: "091" },
              { name: "Hayatabad", code: "HYB", zip: "25100", phone: "091" },
              { name: "University Town", code: "UTW", zip: "25120", phone: "091" }
            ]
          },
          {
            name: "Mardan",
            code: "PK-KP-MDN",
            cities: [
              { name: "Mardan", code: "MDN", zip: "23200", phone: "0937" },
              { name: "Takht Bhai", code: "TKB", zip: "23210", phone: "0937" },
              { name: "Katlang", code: "KTL2", zip: "23220", phone: "0937" }
            ]
          },
          {
            name: "Swat",
            code: "PK-KP-SWT",
            cities: [
              { name: "Mingora", code: "MNG", zip: "19200", phone: "0946" },
              { name: "Saidu Sharif", code: "SDS", zip: "19201", phone: "0946" },
              { name: "Kabal", code: "KBL2", zip: "19210", phone: "0946" },
              { name: "Matta", code: "MTT", zip: "19220", phone: "0946" }
            ]
          },
          {
            name: "Abbottabad",
            code: "PK-KP-ATB",
            cities: [
              { name: "Abbottabad", code: "ATB", zip: "22010", phone: "0992" },
              { name: "Havelian", code: "HVL", zip: "22500", phone: "0992" },
              { name: "Nathiagali", code: "NTG", zip: "22100", phone: "0992" }
            ]
          },
          {
            name: "Swabi",
            code: "PK-KP-SWB",
            cities: [
              { name: "Swabi", code: "SWB", zip: "23430", phone: "0938" },
              { name: "Topi", code: "TPI", zip: "23460", phone: "0938" },
              { name: "Lahor Swabi", code: "LHS", zip: "23400", phone: "0938" }
            ]
          },
          {
            name: "Nowshera",
            code: "PK-KP-NWR",
            cities: [
              { name: "Nowshera", code: "NWR", zip: "24100", phone: "0923" },
              { name: "Pabbi", code: "PBI", zip: "24300", phone: "0923" },
              { name: "Akora Khattak", code: "AKK", zip: "24010", phone: "0923" }
            ]
          },
          {
            name: "Charsadda",
            code: "PK-KP-CSD",
            cities: [
              { name: "Charsadda", code: "CSD", zip: "24460", phone: "091" },
              { name: "Tangi", code: "TNG", zip: "24450", phone: "091" },
              { name: "Shabqadar", code: "SQD", zip: "24430", phone: "091" }
            ]
          },
          {
            name: "Kohat",
            code: "PK-KP-KHT",
            cities: [
              { name: "Kohat", code: "KHT", zip: "26000", phone: "0922" },
              { name: "Lachi", code: "LCI", zip: "26100", phone: "0922" },
              { name: "Gumbat", code: "GBT2", zip: "26200", phone: "0922" }
            ]
          },
          {
            name: "Dera Ismail Khan",
            code: "PK-KP-DIK",
            cities: [
              { name: "Dera Ismail Khan", code: "DIK", zip: "29050", phone: "0966" },
              { name: "Paharpur", code: "PHP", zip: "29100", phone: "0966" },
              { name: "Kulachi", code: "KLC", zip: "29200", phone: "0966" }
            ]
          },
          {
            name: "Mansehra",
            code: "PK-KP-MNS",
            cities: [
              { name: "Mansehra", code: "MNS", zip: "21300", phone: "0997" },
              { name: "Balakot", code: "BLK", zip: "21200", phone: "0997" },
              { name: "Oghi", code: "OGH", zip: "21400", phone: "0997" }
            ]
          },
          {
            name: "Bannu",
            code: "PK-KP-BNU",
            cities: [
              { name: "Bannu", code: "BNU", zip: "28100", phone: "0928" },
              { name: "Domel", code: "DML", zip: "28120", phone: "0928" }
            ]
          },
          {
            name: "Malakand",
            code: "PK-KP-MKD",
            cities: [
              { name: "Batkhela", code: "BTK", zip: "23020", phone: "0932" },
              { name: "Dargai", code: "DRG", zip: "23010", phone: "0932" }
            ]
          },
          {
            name: "Haripur",
            code: "PK-KP-HRP",
            cities: [
              { name: "Haripur", code: "HRP", zip: "22620", phone: "0995" },
              { name: "Ghazi", code: "GHZ", zip: "22860", phone: "0995" }
            ]
          },
          {
            name: "Khyber",
            code: "PK-KP-KHY",
            cities: [
              { name: "Landi Kotal", code: "LKT", zip: "24800", phone: "091" },
              { name: "Jamrud", code: "JMD", zip: "24700", phone: "091" },
              { name: "Bara", code: "BRA", zip: "24600", phone: "091" }
            ]
          },
          {
            name: "Lower Dir",
            code: "PK-KP-LDR",
            cities: [
              { name: "Timergara", code: "TMG", zip: "18300", phone: "0945" },
              { name: "Jandol", code: "JDL", zip: "18310", phone: "0945" }
            ]
          },
          {
            name: "Upper Dir",
            code: "PK-KP-UDR",
            cities: [
              { name: "Dir", code: "DIR", zip: "18000", phone: "0944" },
              { name: "Sheringal", code: "SRG", zip: "18010", phone: "0944" }
            ]
          },
          {
            name: "Chitral Lower",
            code: "PK-KP-LCT",
            cities: [
              { name: "Chitral", code: "CTL", zip: "17200", phone: "0943" },
              { name: "Drosh", code: "DRS", zip: "17220", phone: "0943" }
            ]
          }
        ]
      },
      {
        name: "Islamabad Capital Territory",
        code: "PK-IS",
        districts: [
          {
            name: "Islamabad",
            code: "PK-IS-ISB",
            cities: [
              { name: "Islamabad", code: "ISB", zip: "44000", phone: "051" },
              { name: "Sector F-6", code: "ISB-F6", zip: "44000", phone: "051" },
              { name: "Sector G-9", code: "ISB-G9", zip: "44000", phone: "051" },
              { name: "Blue Area", code: "ISB-BLU", zip: "44000", phone: "051" },
              { name: "Bara Kahu", code: "ISB-BKH", zip: "45400", phone: "051" }
            ]
          }
        ]
      },
      {
        name: "Azad Jammu & Kashmir",
        code: "PK-JK",
        districts: [
          {
            name: "Muzaffarabad",
            code: "PK-JK-MZF",
            cities: [
              { name: "Muzaffarabad", code: "MZF", zip: "13100", phone: "05822" },
              { name: "Pattika", code: "PTK2", zip: "13110", phone: "05822" }
            ]
          },
          {
            name: "Mirpur",
            code: "PK-JK-MRP",
            cities: [
              { name: "Mirpur AJK", code: "MRP", zip: "10250", phone: "05827" },
              { name: "Dadyal", code: "DDL", zip: "10210", phone: "05827" }
            ]
          },
          {
            name: "Kotli",
            code: "PK-JK-KTL",
            cities: [
              { name: "Kotli", code: "KTL3", zip: "11100", phone: "05826" },
              { name: "Sehnsa", code: "SNS", zip: "11110", phone: "05826" }
            ]
          },
          {
            name: "Bhimber",
            code: "PK-JK-BMB",
            cities: [
              { name: "Bhimber", code: "BMB", zip: "10040", phone: "05828" },
              { name: "Barnala", code: "BRN", zip: "10050", phone: "05828" }
            ]
          },
          {
            name: "Poonch",
            code: "PK-JK-PNC",
            cities: [
              { name: "Rawalakot", code: "RWK", zip: "12350", phone: "05824" },
              { name: "Hajira", code: "HJR", zip: "12360", phone: "05824" }
            ]
          }
        ]
      },
      {
        name: "Gilgit-Baltistan",
        code: "PK-GB",
        districts: [
          {
            name: "Gilgit",
            code: "PK-GB-GLG",
            cities: [
              { name: "Gilgit", code: "GLG", zip: "15100", phone: "05811" },
              { name: "Danyor", code: "DNY", zip: "15110", phone: "05811" }
            ]
          },
          {
            name: "Skardu",
            code: "PK-GB-SKD",
            cities: [
              { name: "Skardu", code: "SKD3", zip: "16100", phone: "05815" },
              { name: "Shigar", code: "SGR", zip: "16110", phone: "05815" }
            ]
          },
          {
            name: "Hunza",
            code: "PK-GB-HNZ",
            cities: [
              { name: "Aliabad", code: "ALB", zip: "15700", phone: "05813" },
              { name: "Karimabad", code: "KMB", zip: "15710", phone: "05813" }
            ]
          },
          {
            name: "Diamer",
            code: "PK-GB-DMR",
            cities: [
              { name: "Chilas", code: "CLS", zip: "15200", phone: "05812" }
            ]
          }
        ]
      }
    ]
  },
  {
    name: "Afghanistan",
    iso2: "AF",
    iso3: "AFG",
    currency: "AFN",
    phone: "+93",
    states: [
      {
        name: "Kabul",
        code: "AF-KBL",
        districts: [
          {
            name: "Kabul",
            code: "AF-KBL-DIS",
            cities: [
              { name: "Kabul", code: "KBL", zip: "1001", phone: "020" },
              { name: "Paghman", code: "PGM", zip: "1002", phone: "020" },
              { name: "Bagrami", code: "BGR", zip: "1003", phone: "020" },
              { name: "Deh Sabz", code: "DSZ", zip: "1004", phone: "020" }
            ]
          }
        ]
      },
      {
        name: "Kandahar",
        code: "AF-KDH",
        districts: [
          {
            name: "Kandahar",
            code: "AF-KDH-DIS",
            cities: [
              { name: "Kandahar", code: "KDH", zip: "3801", phone: "030" },
              { name: "Spin Boldak", code: "SPB", zip: "3802", phone: "030" },
              { name: "Arghandab", code: "ARG", zip: "3803", phone: "030" }
            ]
          }
        ]
      },
      {
        name: "Herat",
        code: "AF-HRT",
        districts: [
          {
            name: "Herat",
            code: "AF-HRT-DIS",
            cities: [
              { name: "Herat", code: "HRT", zip: "3001", phone: "040" },
              { name: "Guzara", code: "GZR", zip: "3002", phone: "040" },
              { name: "Enjil", code: "ENJ", zip: "3003", phone: "040" },
              { name: "Islam Qala", code: "ISQ", zip: "3004", phone: "040" }
            ]
          }
        ]
      },
      {
        name: "Balkh",
        code: "AF-BAL",
        districts: [
          {
            name: "Mazar-i-Sharif",
            code: "AF-BAL-DIS",
            cities: [
              { name: "Mazar-i-Sharif", code: "MZR", zip: "1701", phone: "050" },
              { name: "Balkh City", code: "BLKC", zip: "1702", phone: "050" },
              { name: "Hairatan", code: "HRTN", zip: "1703", phone: "050" }
            ]
          }
        ]
      },
      {
        name: "Nangarhar",
        code: "AF-NGR",
        districts: [
          {
            name: "Jalalabad",
            code: "AF-NGR-DIS",
            cities: [
              { name: "Jalalabad", code: "JAA", zip: "2601", phone: "060" },
              { name: "Torkham", code: "TKM", zip: "2602", phone: "060" },
              { name: "Bati Kot", code: "BTK2", zip: "2603", phone: "060" }
            ]
          }
        ]
      },
      {
        name: "Kunduz",
        code: "AF-KDZ",
        districts: [
          {
            name: "Kunduz",
            code: "AF-KDZ-DIS",
            cities: [
              { name: "Kunduz", code: "KDZ", zip: "3501", phone: "070" },
              { name: "Khan Abad", code: "KAB", zip: "3502", phone: "070" },
              { name: "Imam Sahib", code: "IMS", zip: "3503", phone: "070" }
            ]
          }
        ]
      },
      {
        name: "Ghazni",
        code: "AF-GHA",
        districts: [
          {
            name: "Ghazni",
            code: "AF-GHA-DIS",
            cities: [
              { name: "Ghazni", code: "GHA", zip: "2301", phone: "043" },
              { name: "Qarabagh Ghazni", code: "QBG", zip: "2302", phone: "043" }
            ]
          }
        ]
      },
      {
        name: "Helmand",
        code: "AF-HEL",
        districts: [
          {
            name: "Lashkargah",
            code: "AF-HEL-DIS",
            cities: [
              { name: "Lashkargah", code: "LKG", zip: "3901", phone: "080" },
              { name: "Gereshk", code: "GRK", zip: "3902", phone: "080" }
            ]
          }
        ]
      },
      {
        name: "Badakhshan",
        code: "AF-BDS",
        districts: [
          {
            name: "Fayzabad",
            code: "AF-BDS-DIS",
            cities: [
              { name: "Fayzabad", code: "FYZ", zip: "3401", phone: "071" },
              { name: "Kishim", code: "KSM", zip: "3402", phone: "071" }
            ]
          }
        ]
      },
      {
        name: "Badghis",
        code: "AF-BDG",
        districts: [
          {
            name: "Qala i Naw",
            code: "AF-BDG-DIS",
            cities: [{ name: "Qala i Naw", code: "QIN", zip: "3051", phone: "040" }]
          }
        ]
      },
      {
        name: "Baghlan",
        code: "AF-BGL",
        districts: [
          {
            name: "Pul-e Khumri",
            code: "AF-BGL-DIS",
            cities: [
              { name: "Pul-e Khumri", code: "PKH", zip: "3601", phone: "050" },
              { name: "Baghlan City", code: "BGC", zip: "3602", phone: "050" }
            ]
          }
        ]
      },
      {
        name: "Bamyan",
        code: "AF-BAM",
        districts: [
          {
            name: "Bamyan",
            code: "AF-BAM-DIS",
            cities: [
              { name: "Bamyan", code: "BAM", zip: "1601", phone: "020" },
              { name: "Yakawlang", code: "YKW", zip: "1602", phone: "020" }
            ]
          }
        ]
      },
      {
        name: "Daykundi",
        code: "AF-DAY",
        districts: [
          {
            name: "Nili",
            code: "AF-DAY-DIS",
            cities: [{ name: "Nili", code: "NLI", zip: "2401", phone: "020" }]
          }
        ]
      },
      {
        name: "Farah",
        code: "AF-FRA",
        districts: [
          {
            name: "Farah",
            code: "AF-FRA-DIS",
            cities: [{ name: "Farah", code: "FRA", zip: "3201", phone: "040" }]
          }
        ]
      },
      {
        name: "Faryab",
        code: "AF-FYB",
        districts: [
          {
            name: "Maymana",
            code: "AF-FYB-DIS",
            cities: [
              { name: "Maymana", code: "MMN", zip: "3701", phone: "050" },
              { name: "Andkhoy", code: "ADK", zip: "3702", phone: "050" }
            ]
          }
        ]
      },
      {
        name: "Ghor",
        code: "AF-GHO",
        districts: [
          {
            name: "Chaghcharan",
            code: "AF-GHO-DIS",
            cities: [{ name: "Chaghcharan / Firoz Koh", code: "FZK", zip: "3101", phone: "040" }]
          }
        ]
      },
      {
        name: "Jowzjan",
        code: "AF-JOW",
        districts: [
          {
            name: "Sheberghan",
            code: "AF-JOW-DIS",
            cities: [{ name: "Sheberghan", code: "SBG", zip: "1801", phone: "050" }]
          }
        ]
      },
      {
        name: "Khost",
        code: "AF-KHO",
        districts: [
          {
            name: "Khost",
            code: "AF-KHO-DIS",
            cities: [
              { name: "Khost", code: "KHO", zip: "2501", phone: "060" },
              { name: "Tani", code: "TNI", zip: "2502", phone: "060" }
            ]
          }
        ]
      },
      {
        name: "Kunar",
        code: "AF-KNR",
        districts: [
          {
            name: "Asadabad",
            code: "AF-KNR-DIS",
            cities: [{ name: "Asadabad", code: "ABD", zip: "2801", phone: "060" }]
          }
        ]
      },
      {
        name: "Laghman",
        code: "AF-LGM",
        districts: [
          {
            name: "Mihtarlam",
            code: "AF-LGM-DIS",
            cities: [{ name: "Mihtarlam", code: "MTL2", zip: "2701", phone: "060" }]
          }
        ]
      },
      {
        name: "Logar",
        code: "AF-LOG",
        districts: [
          {
            name: "Pul-i-Alam",
            code: "AF-LOG-DIS",
            cities: [{ name: "Pul-i-Alam", code: "PLA", zip: "1901", phone: "020" }]
          }
        ]
      },
      {
        name: "Nimruz",
        code: "AF-NIM",
        districts: [
          {
            name: "Zaranj",
            code: "AF-NIM-DIS",
            cities: [
              { name: "Zaranj", code: "ZRJ", zip: "3301", phone: "040" },
              { name: "Chahar Burjak", code: "CBJ", zip: "3302", phone: "040" }
            ]
          }
        ]
      },
      {
        name: "Nuristan",
        code: "AF-NUR",
        districts: [
          {
            name: "Parun",
            code: "AF-NUR-DIS",
            cities: [{ name: "Parun", code: "PRN", zip: "2901", phone: "060" }]
          }
        ]
      },
      {
        name: "Paktia",
        code: "AF-PIA",
        districts: [
          {
            name: "Gardez",
            code: "AF-PIA-DIS",
            cities: [{ name: "Gardez", code: "GRZ", zip: "2201", phone: "043" }]
          }
        ]
      },
      {
        name: "Paktika",
        code: "AF-PKA",
        districts: [
          {
            name: "Sharan",
            code: "AF-PKA-DIS",
            cities: [{ name: "Sharan", code: "SRN", zip: "2101", phone: "043" }]
          }
        ]
      },
      {
        name: "Panjshir",
        code: "AF-PAN",
        districts: [
          {
            name: "Bazarak",
            code: "AF-PAN-DIS",
            cities: [{ name: "Bazarak", code: "BZK", zip: "1401", phone: "020" }]
          }
        ]
      },
      {
        name: "Parwan",
        code: "AF-PAR",
        districts: [
          {
            name: "Charikar",
            code: "AF-PAR-DIS",
            cities: [
              { name: "Charikar", code: "CHR", zip: "1101", phone: "020" },
              { name: "Bagram", code: "BGR2", zip: "1102", phone: "020" }
            ]
          }
        ]
      },
      {
        name: "Samangan",
        code: "AF-SAM",
        districts: [
          {
            name: "Aybak",
            code: "AF-SAM-DIS",
            cities: [{ name: "Aybak", code: "AYB", zip: "1501", phone: "050" }]
          }
        ]
      },
      {
        name: "Sar-e Pol",
        code: "AF-SAR",
        districts: [
          {
            name: "Sar-e Pol",
            code: "AF-SAR-DIS",
            cities: [{ name: "Sar-e Pol", code: "SRP", zip: "2001", phone: "050" }]
          }
        ]
      },
      {
        name: "Takhar",
        code: "AF-TAK",
        districts: [
          {
            name: "Taloqan",
            code: "AF-TAK-DIS",
            cities: [{ name: "Taloqan", code: "TQN", zip: "3751", phone: "070" }]
          }
        ]
      },
      {
        name: "Urozgan",
        code: "AF-URU",
        districts: [
          {
            name: "Tarin Kowt",
            code: "AF-URU-DIS",
            cities: [{ name: "Tarin Kowt", code: "TRK", zip: "2651", phone: "030" }]
          }
        ]
      },
      {
        name: "Wardak",
        code: "AF-WAR",
        districts: [
          {
            name: "Maidan Shar",
            code: "AF-WAR-DIS",
            cities: [{ name: "Maidan Shar", code: "MDS", zip: "1201", phone: "020" }]
          }
        ]
      },
      {
        name: "Zabul",
        code: "AF-ZAB",
        districts: [
          {
            name: "Qalat",
            code: "AF-ZAB-DIS",
            cities: [{ name: "Qalat", code: "QLT", zip: "2751", phone: "030" }]
          }
        ]
      },
      {
        name: "Kapisa",
        code: "AF-KAP",
        districts: [
          {
            name: "Mahmud-i-Raqi",
            code: "AF-KAP-DIS",
            cities: [{ name: "Mahmud-i-Raqi", code: "MIR", zip: "1301", phone: "020" }]
          }
        ]
      }
    ]
  },
  {
    name: "United Arab Emirates",
    iso2: "AE",
    iso3: "ARE",
    currency: "AED",
    phone: "+971",
    states: [
      {
        name: "Abu Dhabi",
        code: "AE-AZ",
        districts: [
          {
            name: "Abu Dhabi Region",
            code: "AE-AZ-AUH",
            cities: [
              { name: "Abu Dhabi City", code: "AUH", zip: "00000", phone: "02" },
              { name: "Mussafah", code: "MSF", zip: "00000", phone: "02" },
              { name: "Al Reem Island", code: "ARM", zip: "00000", phone: "02" },
              { name: "Yas Island", code: "YAS", zip: "00000", phone: "02" },
              { name: "Saadiyat Island", code: "SDT", zip: "00000", phone: "02" },
              { name: "Khalifa City", code: "KFC", zip: "00000", phone: "02" },
              { name: "Mohammed Bin Zayed City", code: "MBZ", zip: "00000", phone: "02" }
            ]
          },
          {
            name: "Al Ain Region",
            code: "AE-AZ-AAN",
            cities: [
              { name: "Al Ain", code: "AAN", zip: "00000", phone: "03" },
              { name: "Al Yahar", code: "YHR", zip: "00000", phone: "03" },
              { name: "Al Hayer", code: "HYR", zip: "00000", phone: "03" },
              { name: "Sweihan", code: "SWH", zip: "00000", phone: "03" }
            ]
          },
          {
            name: "Al Dhafra Region",
            code: "AE-AZ-ADH",
            cities: [
              { name: "Madinat Zayed", code: "MDZ", zip: "00000", phone: "02" },
              { name: "Ruwais", code: "RWS", zip: "00000", phone: "02" },
              { name: "Mirfa", code: "MRF", zip: "00000", phone: "02" },
              { name: "Ghayathi", code: "GYT", zip: "00000", phone: "02" },
              { name: "Liwa", code: "LWA", zip: "00000", phone: "02" }
            ]
          }
        ]
      },
      {
        name: "Dubai",
        code: "AE-DU",
        districts: [
          {
            name: "Bur Dubai & Downtown",
            code: "AE-DU-BUR",
            cities: [
              { name: "Dubai", code: "DXB", zip: "00000", phone: "04" },
              { name: "Bur Dubai", code: "BDB", zip: "00000", phone: "04" },
              { name: "Downtown Dubai", code: "DTD", zip: "00000", phone: "04" },
              { name: "Business Bay", code: "BSB", zip: "00000", phone: "04" },
              { name: "DIFC", code: "DIFC", zip: "00000", phone: "04" },
              { name: "Al Satwa", code: "STW", zip: "00000", phone: "04" }
            ]
          },
          {
            name: "Deira",
            code: "AE-DU-DRA",
            cities: [
              { name: "Deira", code: "DRA", zip: "00000", phone: "04" },
              { name: "Al Rigga", code: "RGA", zip: "00000", phone: "04" },
              { name: "Al Rashidiya Dubai", code: "RSD", zip: "00000", phone: "04" },
              { name: "Al Garhoud", code: "GHD", zip: "00000", phone: "04" }
            ]
          },
          {
            name: "Jumeirah & Marina",
            code: "AE-DU-JUM",
            cities: [
              { name: "Jumeirah", code: "JMH", zip: "00000", phone: "04" },
              { name: "Dubai Marina", code: "MRN", zip: "00000", phone: "04" },
              { name: "JBR (Jumeirah Beach Residence)", code: "JBR", zip: "00000", phone: "04" },
              { name: "Palm Jumeirah", code: "PJM", zip: "00000", phone: "04" },
              { name: "Jumeirah Lakes Towers", code: "JLT", zip: "00000", phone: "04" }
            ]
          },
          {
            name: "Outer Dubai & Jebel Ali",
            code: "AE-DU-JAF",
            cities: [
              { name: "Jebel Ali", code: "JAF", zip: "00000", phone: "04" },
              { name: "Dubai Silicon Oasis", code: "DSO", zip: "00000", phone: "04" },
              { name: "Dubai South", code: "DBS", zip: "00000", phone: "04" },
              { name: "Al Quoz Industrial", code: "AQZ", zip: "00000", phone: "04" },
              { name: "International City", code: "INC", zip: "00000", phone: "04" },
              { name: "Dubai Investment Park", code: "DIP", zip: "00000", phone: "04" }
            ]
          }
        ]
      },
      {
        name: "Sharjah",
        code: "AE-SH",
        districts: [
          {
            name: "Sharjah City Region",
            code: "AE-SH-SHJ",
            cities: [
              { name: "Sharjah City", code: "SHJ", zip: "00000", phone: "06" },
              { name: "Al Nahda Sharjah", code: "NHD", zip: "00000", phone: "06" },
              { name: "Al Majaz", code: "MJZ", zip: "00000", phone: "06" },
              { name: "Al Qasimia", code: "QSM2", zip: "00000", phone: "06" },
              { name: "Muwaileh", code: "MWL2", zip: "00000", phone: "06" }
            ]
          },
          {
            name: "Eastern Region",
            code: "AE-SH-EST",
            cities: [
              { name: "Khor Fakkan", code: "KFK", zip: "00000", phone: "09" },
              { name: "Kalba", code: "KLB", zip: "00000", phone: "09" },
              { name: "Dibba Al-Hisn", code: "DBH", zip: "00000", phone: "09" }
            ]
          },
          {
            name: "Central Region",
            code: "AE-SH-CNT",
            cities: [
              { name: "Al Dhaid", code: "DHD", zip: "00000", phone: "06" },
              { name: "Al Madam", code: "MDM", zip: "00000", phone: "06" }
            ]
          }
        ]
      },
      {
        name: "Ajman",
        code: "AE-AJ",
        districts: [
          {
            name: "Ajman City",
            code: "AE-AJ-AJM",
            cities: [
              { name: "Ajman City", code: "AJM", zip: "00000", phone: "06" },
              { name: "Al Nuaimia", code: "NMC", zip: "00000", phone: "06" },
              { name: "Al Rashidiya Ajman", code: "RSA", zip: "00000", phone: "06" },
              { name: "Al Jurf", code: "JRF", zip: "00000", phone: "06" }
            ]
          },
          {
            name: "Inland Enclaves",
            code: "AE-AJ-INL",
            cities: [
              { name: "Masfout", code: "MST2", zip: "00000", phone: "06" },
              { name: "Manama Ajman", code: "MNM", zip: "00000", phone: "06" }
            ]
          }
        ]
      },
      {
        name: "Ras Al Khaimah",
        code: "AE-RK",
        districts: [
          {
            name: "Ras Al Khaimah City",
            code: "AE-RK-RKT",
            cities: [
              { name: "Ras Al Khaimah City", code: "RKT", zip: "00000", phone: "07" },
              { name: "Al Nakheel", code: "NKL", zip: "00000", phone: "07" },
              { name: "Al Hamra Village", code: "AHV", zip: "00000", phone: "07" },
              { name: "Mina Al Arab", code: "MAA", zip: "00000", phone: "07" }
            ]
          },
          {
            name: "Southern RAK",
            code: "AE-RK-STH",
            cities: [
              { name: "Al Jazirah Al Hamra", code: "JAH", zip: "00000", phone: "07" },
              { name: "Digdaga", code: "DGD", zip: "00000", phone: "07" }
            ]
          }
        ]
      },
      {
        name: "Fujairah",
        code: "AE-FU",
        districts: [
          {
            name: "Fujairah City",
            code: "AE-FU-FJR",
            cities: [
              { name: "Fujairah City", code: "FJR", zip: "00000", phone: "09" },
              { name: "Al Faseel", code: "FSL", zip: "00000", phone: "09" },
              { name: "Merashid", code: "MRS", zip: "00000", phone: "09" }
            ]
          },
          {
            name: "Dibba Region",
            code: "AE-FU-DBA",
            cities: [
              { name: "Dibba Al-Fujairah", code: "DBF", zip: "00000", phone: "09" },
              { name: "Al Bithnah", code: "BTN", zip: "00000", phone: "09" },
              { name: "Mirbah", code: "MRB", zip: "00000", phone: "09" }
            ]
          }
        ]
      },
      {
        name: "Umm Al Quwain",
        code: "AE-UQ",
        districts: [
          {
            name: "Umm Al Quwain City",
            code: "AE-UQ-UAQ",
            cities: [
              { name: "Umm Al Quwain City", code: "UAQ", zip: "00000", phone: "06" },
              { name: "Al Salamah", code: "SLM", zip: "00000", phone: "06" },
              { name: "Falaj Al Mualla", code: "FAM", zip: "00000", phone: "06" },
              { name: "Al Raafa", code: "RFA", zip: "00000", phone: "06" }
            ]
          }
        ]
      }
    ]
  }
];

async function runLocationSeed() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });
    }

    const sql = postgres(databaseUrl, { max: 1, prepare: false });

    const stats = {
      countriesProcessed: 0,
      statesProcessed: 0,
      districtsProcessed: 0,
      citiesProcessed: 0,
      errors: [] as string[]
    };

    for (const cData of OFFICIAL_LOCATIONS_DATA) {
      try {
        // 1. Get or Create Country
        let countryId: string | null = null;
        const [cMatch] = await sql`
          select id from public.countries 
          where deleted_at is null 
            and (lower(name) = lower(${cData.name}) or iso2 = ${cData.iso2} or iso3 = ${cData.iso3})
          limit 1
        `;

        if (cMatch?.id) {
          countryId = cMatch.id;
          await sql`
            update public.countries 
            set name = ${cData.name}, iso2 = ${cData.iso2}, iso3 = ${cData.iso3}, 
                currency_code = ${cData.currency}, phone_code = ${cData.phone}, updated_at = now()
            where id = ${countryId}
          `;
        } else {
          const [cIns] = await sql`
            insert into public.countries (name, iso2, iso3, currency_code, phone_code, default_language_code, official_email, admin_email, is_active)
            values (${cData.name}, ${cData.iso2}, ${cData.iso3}, ${cData.currency}, ${cData.phone}, 'en', ${`official@dgt.${cData.iso2.toLowerCase()}`}, ${`admin@dgt.${cData.iso2.toLowerCase()}`}, true)
            returning id
          `;
          countryId = cIns.id;
        }

        stats.countriesProcessed++;

        // 2. Process States
        for (const sData of cData.states) {
          let stateId: string | null = null;
          const [sMatch] = await sql`
            select id from public.states_provinces
            where country_id = ${countryId} and deleted_at is null
              and (lower(name) = lower(${sData.name}) or code = ${sData.code})
            limit 1
          `;

          if (sMatch?.id) {
            stateId = sMatch.id;
            await sql`
              update public.states_provinces
              set name = ${sData.name}, code = ${sData.code}, is_active = true, updated_at = now()
              where id = ${stateId}
            `;
          } else {
            const [sIns] = await sql`
              insert into public.states_provinces (country_id, name, code, is_active)
              values (${countryId}, ${sData.name}, ${sData.code}, true)
              returning id
            `;
            stateId = sIns.id;
          }

          stats.statesProcessed++;

          // 3. Process Districts
          for (const dData of sData.districts) {
            let districtId: string | null = null;
            const [dMatch] = await sql`
              select id from public.districts
              where state_province_id = ${stateId} and deleted_at is null
                and (lower(name) = lower(${dData.name}) or code = ${dData.code})
              limit 1
            `;

            if (dMatch?.id) {
              districtId = dMatch.id;
              await sql`
                update public.districts
                set name = ${dData.name}, code = ${dData.code}, country_id = ${countryId}, is_active = true, updated_at = now()
                where id = ${districtId}
              `;
            } else {
              const [dIns] = await sql`
                insert into public.districts (country_id, state_province_id, name, code, is_active)
                values (${countryId}, ${stateId}, ${dData.name}, ${dData.code}, true)
                returning id
              `;
              districtId = dIns.id;
            }

            stats.districtsProcessed++;

            // 4. Process Cities
            for (const cityData of dData.cities) {
              const [cityMatch] = await sql`
                select id from public.cities
                where country_id = ${countryId} and deleted_at is null
                  and (lower(name) = lower(${cityData.name}) or code = ${cityData.code})
                limit 1
              `;

              if (cityMatch?.id) {
                await sql`
                  update public.cities
                  set name = ${cityData.name}, code = ${cityData.code}, 
                      state_province_id = ${stateId}, district_id = ${districtId},
                      zip_code = ${cityData.zip || null}, phone_area_code = ${cityData.phone || null},
                      is_active = true, updated_at = now()
                  where id = ${cityMatch.id}
                `;
              } else {
                await sql`
                  insert into public.cities (country_id, state_province_id, district_id, name, code, zip_code, phone_area_code, is_active)
                  values (${countryId}, ${stateId}, ${districtId}, ${cityData.name}, ${cityData.code}, ${cityData.zip || null}, ${cityData.phone || null}, true)
                `;
              }

              stats.citiesProcessed++;
            }
          }
        }
      } catch (err: any) {
        stats.errors.push(`Error processing ${cData.name}: ${err?.message || String(err)}`);
      }
    }

    await sql.end();

    return NextResponse.json({
      success: true,
      message: "Official location master data populated directly into server database tables.",
      stats
    });
}

/**
 * GET = read-only status (how much reference location data is already loaded).
 * The heavy idempotent seed now runs only on POST and only for a super admin —
 * it used to run on an unauthenticated GET, which both left it open to anyone
 * and made a bare GET take 60-90s.
 */
export async function GET(_request: NextRequest) {
  try {
    await requireErpSession();
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });
    const sql = postgres(databaseUrl, { max: 1, prepare: false });
    try {
      const [c] = await sql`SELECT COUNT(*)::int n FROM public.countries WHERE deleted_at IS NULL`;
      const [s] = await sql`SELECT COUNT(*)::int n FROM public.states_provinces WHERE deleted_at IS NULL`;
      const [d] = await sql`SELECT COUNT(*)::int n FROM public.districts WHERE deleted_at IS NULL`;
      const [ci] = await sql`SELECT COUNT(*)::int n FROM public.cities WHERE deleted_at IS NULL`;
      return NextResponse.json({
        success: true,
        seededCountriesAvailable: OFFICIAL_LOCATIONS_DATA.length,
        current: { countries: c.n, states: s.n, districts: d.n, cities: ci.n },
        hint: "POST to this endpoint as a super admin to (re-)run the idempotent seed.",
      });
    } finally {
      await sql.end({ timeout: 5 });
    }
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(_request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin && !session.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Forbidden: super admin only." }, { status: 403 });
    }
    return await runLocationSeed();
  } catch (error) {
    return handleApiError(error);
  }
}
