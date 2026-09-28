import fs from "node:fs";
import postgres from "postgres";

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

const GOODS_DATA = [
  // 1. Dry Fruits
  { name: "Walnut Kernel", desc: "The edible inner kernel of the walnut fruit. Walnuts grow on large walnut trees; the fruit develops on the branches with a green outer husk and hard shell. After removing the husk and shell, the edible kernel is obtained." },
  { name: "Walnut In-Shell", desc: "The mature walnut fruit with its natural hard shell intact. It grows on a walnut tree and develops inside a green outer husk, which is removed after harvesting." },
  { name: "Almond Kernel", desc: "The edible seed found inside the hard shell of an almond fruit. Almonds grow on almond trees; after the outer hull and shell are removed, the inner almond kernel is obtained." },
  { name: "Almond In-Shell", desc: "The almond seed kept inside its natural hard shell. Almonds grow on almond trees and develop inside a soft outer hull surrounding the shell." },
  { name: "Pistachio Kernel", desc: "The edible inner seed of the pistachio fruit. Pistachios grow in clusters on pistachio trees; the outer hull and shell are removed to obtain the kernel." },
  { name: "Pistachio In-Shell", desc: "The pistachio nut with its natural shell. It grows on a pistachio tree in clusters, and the shell commonly opens naturally as the nut matures." },
  { name: "Cashew Kernel", desc: "The edible seed of the cashew tree. The cashew nut grows externally at the bottom of the cashew apple; after processing and removing the hard shell, the kernel is obtained." },
  { name: "Cashew In-Shell", desc: "The raw cashew nut with its natural shell. It grows attached to the lower end of the cashew apple on the cashew tree." },
  { name: "Hazelnut Kernel", desc: "The edible seed inside the hazelnut shell. Hazelnuts grow on hazel trees or shrubs and develop in clusters surrounded by leafy husks." },
  { name: "Hazelnut In-Shell", desc: "The hazelnut fruit with its hard natural shell intact. It grows on hazel trees or shrubs in small clusters." },
  { name: "Chestnut Kernel", desc: "The edible inner part of the chestnut. Chestnuts grow on chestnut trees inside a spiny outer burr; the burr and hard shell are removed to obtain the kernel." },
  { name: "Chestnut In-Shell", desc: "The mature chestnut with its natural hard shell. Chestnuts grow inside a spiny burr on large chestnut trees." },
  { name: "Brazil Nut Kernel", desc: "The edible seed of the Brazil nut tree. Several Brazil nuts develop inside a large, hard, round fruit capsule growing on very tall rainforest trees." },
  { name: "Brazil Nut In-Shell", desc: "The Brazil nut seed with its hard shell intact. The nuts develop together inside a large woody fruit produced by the Brazil nut tree." },
  { name: "Macadamia Kernel", desc: "The edible inner seed of the macadamia fruit. Macadamia nuts grow on trees and are enclosed in a very hard shell covered by an outer green husk." },
  { name: "Macadamia In-Shell", desc: "The macadamia nut with its extremely hard natural shell intact. It grows on the macadamia tree beneath an outer green husk." },
  { name: "Pine Nut Kernel", desc: "The edible seed obtained from certain species of pine trees. Pine nuts develop inside pine cones; the cone opens and the seeds are collected and shelled." },
  { name: "Pine Nut In-Shell", desc: "The pine seed with its natural shell. The seeds develop between the scales of pine cones growing on pine trees." },
  { name: "Raisins", desc: "Dried grapes produced from fruit growing in bunches on grape vines. Fresh grapes are harvested and naturally or mechanically dried to reduce moisture and create raisins." },
  { name: "Dried Figs", desc: "Dried fruit of the fig tree. Figs grow directly on the branches of the fig tree and are harvested ripe before being dried to reduce moisture." },
  { name: "Dates", desc: "Fruit of the date palm tree. Dates grow in large hanging clusters high on date palms and are harvested at different maturity stages before drying or packing." },
  { name: "Dried Apricot", desc: "The dried fruit of the apricot tree. Apricots grow on tree branches and contain one central stone; ripe fruit is harvested and dried whole or in halves." },
  { name: "Prunes", desc: "Dried plums produced from selected plum varieties. Plums grow on trees and are dried after harvesting to create prunes." },
  { name: "Dried Apple", desc: "Apple fruit from an apple tree that has been sliced, ring-cut, or otherwise prepared and dried to remove moisture." },

  // 2. Pulses
  { name: "Dry Peas", desc: "Mature dry seeds of the pea plant. Peas grow inside pods on a low-growing legume plant; the pods are allowed to mature and dry before the seeds are collected." },
  { name: "Yellow Peas", desc: "Yellow-colored mature seeds produced inside pods of the pea plant. They are harvested after the plant and pods have dried." },
  { name: "Green Peas", desc: "Green-colored mature dry seeds from pea pods. Unlike fresh green peas, these are allowed to mature and dry before harvesting." },
  { name: "Chickpeas", desc: "Mature edible seeds of the chickpea plant. Chickpeas develop inside small pods on a short bushy legume plant, usually one or two seeds per pod." },
  { name: "Kabuli Chickpeas", desc: "Large, light-colored chickpea seeds grown inside pods on the chickpea plant. They are generally larger and smoother than Desi chickpeas." },
  { name: "Desi Chickpeas", desc: "Smaller, darker chickpea seeds grown inside pods of the chickpea plant. They normally have a rougher seed coat than Kabuli types." },
  { name: "Mung Beans", desc: "Mature seeds of the mung bean plant. The beans grow inside long pods on a small legume plant and are harvested after the pods dry." },
  { name: "Urad / Black Gram", desc: "Dark-colored mature seeds produced inside pods of the black gram legume plant. The dried pods are harvested and threshed to obtain the beans." },
  { name: "Adzuki Beans", desc: "Small reddish beans produced inside pods of the adzuki bean plant. The plant is a legume and the mature dry seeds are harvested from dried pods." },
  { name: "Kidney Beans", desc: "Kidney-shaped mature seeds grown inside pods of common bean plants. The pods mature and dry before the beans are removed." },
  { name: "Red Kidney Beans", desc: "Red-colored kidney-shaped beans produced inside pods on a common bean plant and harvested as mature dry seeds." },
  { name: "White Kidney Beans", desc: "White kidney-shaped dry seeds produced inside bean pods on legume plants." },
  { name: "Navy Beans", desc: "Small white dry beans produced inside pods of the common bean plant. They are harvested after full maturity and drying." },
  { name: "Pinto Beans", desc: "Speckled dry beans grown inside pods of common bean plants. The beans develop as seeds inside the pods and are harvested when dry." },
  { name: "Black Beans", desc: "Black-colored mature seeds grown inside pods of bean plants. The dry pods are harvested and threshed for the beans." },
  { name: "Lima Beans", desc: "Flat, broad seeds produced inside pods of the lima bean plant, a climbing or bush-type legume." },
  { name: "Cowpeas", desc: "Mature seeds of the cowpea plant. Cowpeas develop inside long pods on a warm-climate legume plant." },
  { name: "Black-Eyed Peas", desc: "A type of cowpea identified by a dark “eye” around the seed scar. The seeds grow inside pods on the cowpea plant." },
  { name: "Lentils", desc: "Small lens-shaped seeds produced inside short pods of the lentil plant. Lentils grow on a low, bushy legume plant." },
  { name: "Red Lentils", desc: "Red/orange lentil seeds produced inside small pods of the lentil plant; often sold whole or split." },
  { name: "Green Lentils", desc: "Green-colored mature seeds from pods of the lentil plant, harvested after the plant has dried." },
  { name: "Brown Lentils", desc: "Brown mature seeds produced inside pods of the lentil plant and dried naturally before harvesting." },
  { name: "Yellow Lentils", desc: "Yellow-colored lentil seeds, commonly obtained after removing the outer seed coat from certain lentil varieties." },
  { name: "Black Lentils", desc: "Small dark-colored lentil seeds produced inside pods on the lentil plant." },
  { name: "Broad / Fava Beans", desc: "Large flat seeds produced inside thick pods on the fava bean plant, a tall upright legume." },
  { name: "Pigeon Peas / Toor", desc: "Mature seeds produced inside pods on the pigeon pea plant, which grows as a woody shrub-like legume." },

  // 3. Roots & Tubers
  { name: "Cassava", desc: "A large starchy storage root that grows underground from the cassava plant. The edible portion is dug out of the soil and can be dried, sliced, chipped, or processed into starch." },
  { name: "Sweet Potato", desc: "A swollen storage root that develops underground in the soil from the sweet potato vine. The edible root stores starch and natural sugars." },
  { name: "Yam", desc: "An underground starchy tuber produced by climbing plants of the Dioscorea group. The tuber develops below the soil and is dug up when mature." },
  { name: "Taro", desc: "An underground corm produced by the taro plant. The large starchy corm grows below ground while broad leaves grow above the soil." },
  { name: "Yautia / Cocoyam", desc: "An edible underground corm and cormels produced by the Xanthosoma-type plant. The usable starchy portion develops beneath the soil." },
  { name: "Arrowroot", desc: "A starch-rich underground rhizome produced by the arrowroot plant. The rhizomes are dug from the soil and commonly processed for starch." },
  { name: "Jerusalem Artichoke", desc: "An underground edible tuber produced by a tall sunflower-related plant. The tubers develop in the soil around the plant's roots." },
  { name: "Salep Root", desc: "Underground tubers of certain orchid plants. The tubers are collected, dried, and traditionally ground for use in food and beverages." },
  { name: "Other Roots & Tubers", desc: "Other edible underground plant parts such as roots, tubers, corms, or rhizomes that store starch or similar nutrients beneath the soil." },

  // 4. Spices / Garam Masala
  { name: "Black Pepper Whole", desc: "Dried berries of the black pepper climbing vine. The berries grow in hanging spikes and are harvested before full ripening, then dried until dark and wrinkled." },
  { name: "Black Pepper Ground", desc: "Powder made by grinding dried black pepper berries harvested from the pepper vine." },
  { name: "Red Chilli Whole", desc: "Mature chilli fruit produced on Capsicum plants. The ripe red fruits are harvested and dried whole." },
  { name: "Red Chilli Powder", desc: "Powder obtained by grinding dried mature red chilli fruits, with or without part of the seeds." },
  { name: "Paprika Whole", desc: "Mature red Capsicum fruit grown on pepper plants and dried after harvesting. Usually selected for color and relatively mild flavor." },
  { name: "Paprika Powder", desc: "Fine powder made by grinding dried paprika-type Capsicum fruits." },
  { name: "Cinnamon Whole", desc: "Dried inner bark obtained from cinnamon trees. Bark is peeled from stems or branches and curls into quills as it dries." },
  { name: "Cinnamon Powder", desc: "Powder produced by grinding dried cinnamon tree bark." },
  { name: "Cloves Whole", desc: "Unopened flower buds of the clove tree. The buds are picked before the flowers open and dried until they become dark brown." },
  { name: "Cloves Ground", desc: "Powder made by grinding dried flower buds of the clove tree." },
  { name: "Nutmeg Whole", desc: "The hard seed found inside the fruit of the nutmeg tree. The fruit splits when mature, exposing the seed and its surrounding mace." },
  { name: "Nutmeg Ground", desc: "Powder produced by grinding the dried seed of the nutmeg fruit." },
  { name: "Mace Whole", desc: "The red/orange lace-like aril that surrounds the nutmeg seed inside the fruit. It is removed and dried separately." },
  { name: "Mace Ground", desc: "Powder made by grinding dried mace, the outer aril surrounding the nutmeg seed." },
  { name: "Cardamom Whole", desc: "Seed pods produced on a perennial herbaceous cardamom plant. The green or dried pods contain numerous aromatic seeds." },
  { name: "Cardamom Ground", desc: "Powder made from cardamom seeds or whole dried cardamom pods." },
  { name: "Coriander Seeds", desc: "Mature dried seeds of the coriander herb. The same plant produces fresh coriander leaves before flowering and seed formation." },
  { name: "Coriander Powder", desc: "Powder obtained by grinding dried mature coriander seeds." },
  { name: "Cumin Seeds", desc: "Dried elongated seeds of the cumin herb. The plant produces small flowers followed by aromatic seed-like fruits." },
  { name: "Cumin Powder", desc: "Powder made from ground dried cumin seeds." },
  { name: "Fennel Seeds", desc: "Aromatic dried seeds/fruits produced by the fennel herb after its yellow flower clusters mature." },
  { name: "Fennel Powder", desc: "Powder obtained by grinding dried fennel seeds." },
  { name: "Anise Seeds", desc: "Aromatic seeds/fruits produced by the anise herb. The small seeds form after the plant's flowers mature." },
  { name: "Anise Powder", desc: "Ground powder produced from dried anise seeds." },
  { name: "Star Anise", desc: "Star-shaped dried fruit produced by an evergreen tree. Each woody point of the star normally contains a seed." },
  { name: "Star Anise Powder", desc: "Powder obtained by grinding dried star-shaped fruits of the star anise tree." },
  { name: "Caraway Seeds", desc: "Aromatic dried fruits/seeds produced by the caraway herb after flowering." },
  { name: "Caraway Powder", desc: "Powder obtained by grinding dried caraway seeds." },
  { name: "Juniper Berries", desc: "Berry-like seed cones produced by juniper shrubs or small trees. They mature on the branches and are dried for spice use." },
  { name: "Ginger Whole / Dry", desc: "The dried underground rhizome of the ginger plant. The usable aromatic part grows horizontally below the soil and is dug up after maturity." },
  { name: "Ginger Powder", desc: "Powder made by drying and grinding the underground ginger rhizome." },
  { name: "Saffron", desc: "The dried red stigmas from flowers of the saffron crocus plant. Each flower produces only a few stigmas, which are hand collected and dried." },
  { name: "Turmeric Whole", desc: "The dried underground rhizome of the turmeric plant. The rhizome grows beneath the soil and develops its characteristic yellow/orange color." },
  { name: "Turmeric Powder", desc: "Powder made by drying and grinding turmeric rhizomes harvested from beneath the soil." },
  { name: "Thyme", desc: "Aromatic leaves and tender stems of the thyme herb or small shrub. The above-ground parts are harvested and dried." },
  { name: "Bay Leaves", desc: "Aromatic leaves harvested from the bay laurel tree. Mature leaves are picked from the branches and dried before use." },
  { name: "Curry Spice Mix", desc: "A prepared mixture of several dried spices such as turmeric, coriander, cumin, chilli, fenugreek and other spices. It does not come from one single plant." },
  { name: "Garam Masala Mix", desc: "A blended spice product made from several whole or ground spices, commonly including cumin, coriander, black pepper, cardamom, cinnamon, cloves and similar aromatic spices." },
  { name: "Other Mixed Spices", desc: "A mixture made from two or more dried spices originating from different seeds, fruits, bark, roots, rhizomes, leaves or flower parts." },
  { name: "Other Single Spice", desc: "Any individual dried spice obtained from one plant source, such as its seed, fruit, bark, leaf, flower, root or rhizome." },
];

async function main() {
  console.log(`Checking match for ${GOODS_DATA.length} goods items...`);
  const dbGoods = await sql`
    SELECT id, goods_name, chs_code, category
    FROM public.goods
    WHERE deleted_at IS NULL;
  `;
  const dbMap = new Map();
  for (const g of dbGoods) {
    dbMap.set(g.goods_name.toLowerCase().trim(), g);
  }

  let matched = 0;
  let missing = [];

  for (const item of GOODS_DATA) {
    const key = item.name.toLowerCase().trim();
    if (dbMap.has(key)) {
      matched++;
    } else {
      missing.push(item.name);
    }
  }

  console.log(`Matched: ${matched} / ${GOODS_DATA.length}`);
  if (missing.length > 0) {
    console.log("Missing goods in DB:", missing);
  }
  await sql.end();
}

main().catch(console.error);
