-- Migration: 20261009_populate_goods_commercial_descriptions.sql
-- Description: Populate full product descriptions / commercial specifications for all 99 master goods
--              in public.goods.extra_details and register 5-language translations (en, ur, ar, fa, ps)
--              in public.record_translations.

DO $$
DECLARE
  v_good RECORD;
BEGIN

  -- Walnut Kernel
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Walnut Kernel') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The edible inner kernel of the walnut fruit. Walnuts grow on large walnut trees; the fruit develops on the branches with a green outer husk and hard shell. After removing the husk and shell, the edible kernel is obtained.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The edible inner kernel of the walnut fruit. Walnuts grow on large walnut trees; the fruit develops on the branches with a green outer husk and hard shell. After removing the husk and shell, the edible kernel is obtained.',
      'en'::text,
      'The edible inner kernel of the walnut fruit. Walnuts grow on large walnut trees; the fruit develops on the branches with a green outer husk and hard shell. After removing the husk and shell, the edible kernel is obtained.',
      'اخروٹ کے پھل کا کھانے کے قابل اندرونی مغز۔ اخروٹ بڑے درختوں پر اگتے ہیں؛ پھل شاخوں پر سبز بیرونی چھلکے اور سخت خول کے ساتھ بنتا ہے۔ چھلکا اور خول ہٹانے کے بعد کھانے کے قابل مغز حاصل ہوتا ہے۔',
      'اللب الداخلي الصالح للأكل لثمرة الجوز. ينمو الجوز على أشجار كبيرة، حيث تتطور الثمرة على الأغصان بغلاف خارجي أخضر وقشرة صلبة، ويتم الحصول على اللب بعد إزالتهما.',
      'مغز خوراکی درونی میوه گردو. گردو روی درختان بزرگ رشد می‌کند؛ میوه روی شاخه‌ها با پوسته سبز بیرونی و پوست سخت تشکیل می‌شود و پس از جدا کردن آن‌ها مغز به دست می‌آید.',
      'د غوزانو د مېوې خوراکي داخلي مغز. غوزان په لویو ونو کې وده کوي؛ مېوه پر ښاخونو د شین پوستکي او سخت پوښ سره جوړېږي، چې د هغوی له لرې کولو وروسته مغز ترلاسه کېږي.',
      '{"en":"The edible inner kernel of the walnut fruit. Walnuts grow on large walnut trees; the fruit develops on the branches with a green outer husk and hard shell. After removing the husk and shell, the edible kernel is obtained.","ur":"اخروٹ کے پھل کا کھانے کے قابل اندرونی مغز۔ اخروٹ بڑے درختوں پر اگتے ہیں؛ پھل شاخوں پر سبز بیرونی چھلکے اور سخت خول کے ساتھ بنتا ہے۔ چھلکا اور خول ہٹانے کے بعد کھانے کے قابل مغز حاصل ہوتا ہے۔","ar":"اللب الداخلي الصالح للأكل لثمرة الجوز. ينمو الجوز على أشجار كبيرة، حيث تتطور الثمرة على الأغصان بغلاف خارجي أخضر وقشرة صلبة، ويتم الحصول على اللب بعد إزالتهما.","fa":"مغز خوراکی درونی میوه گردو. گردو روی درختان بزرگ رشد می‌کند؛ میوه روی شاخه‌ها با پوسته سبز بیرونی و پوست سخت تشکیل می‌شود و پس از جدا کردن آن‌ها مغز به دست می‌آید.","ps":"د غوزانو د مېوې خوراکي داخلي مغز. غوزان په لویو ونو کې وده کوي؛ مېوه پر ښاخونو د شین پوستکي او سخت پوښ سره جوړېږي، چې د هغوی له لرې کولو وروسته مغز ترلاسه کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Walnut In-Shell
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Walnut In-Shell') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The mature walnut fruit with its natural hard shell intact. It grows on a walnut tree and develops inside a green outer husk, which is removed after harvesting.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The mature walnut fruit with its natural hard shell intact. It grows on a walnut tree and develops inside a green outer husk, which is removed after harvesting.',
      'en'::text,
      'The mature walnut fruit with its natural hard shell intact. It grows on a walnut tree and develops inside a green outer husk, which is removed after harvesting.',
      'قدرتی سخت خول کے ساتھ تیار اخروٹ کا پھل۔ یہ اخروٹ کے درخت پر اگتا ہے اور سبز بیرونی چھلکے کے اندر پروان چڑھتا ہے جسے کٹائی کے بعد الگ کر دیا جاتا ہے۔',
      'ثمرة الجوز الناضجة المحتفظة بقشرتها الصلبة الطبيعية. تنمو على شجرة الجوز داخل غلاف خارجي أخضر يتم نزعه بعد الحصاد.',
      'میوه رسیده گردو با پوست سخت طبیعی و دست‌نخورده. روی درخت گردو رشد کرده و داخل پوسته سبز بیرونی نمو می‌یابد که پس از برداشت جدا می‌شود.',
      'د غوزانو پخه مېوه له خپل طبیعي سخت پوښ سره. دا د غوزانو په ونه کې د شنه خارجي پوستکي دننه وده کوي چې له حاصل ټولولو وروسته لیرې کېږي.',
      '{"en":"The mature walnut fruit with its natural hard shell intact. It grows on a walnut tree and develops inside a green outer husk, which is removed after harvesting.","ur":"قدرتی سخت خول کے ساتھ تیار اخروٹ کا پھل۔ یہ اخروٹ کے درخت پر اگتا ہے اور سبز بیرونی چھلکے کے اندر پروان چڑھتا ہے جسے کٹائی کے بعد الگ کر دیا جاتا ہے۔","ar":"ثمرة الجوز الناضجة المحتفظة بقشرتها الصلبة الطبيعية. تنمو على شجرة الجوز داخل غلاف خارجي أخضر يتم نزعه بعد الحصاد.","fa":"میوه رسیده گردو با پوست سخت طبیعی و دست‌نخورده. روی درخت گردو رشد کرده و داخل پوسته سبز بیرونی نمو می‌یابد که پس از برداشت جدا می‌شود.","ps":"د غوزانو پخه مېوه له خپل طبیعي سخت پوښ سره. دا د غوزانو په ونه کې د شنه خارجي پوستکي دننه وده کوي چې له حاصل ټولولو وروسته لیرې کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Almond Kernel
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Almond Kernel') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The edible seed found inside the hard shell of an almond fruit. Almonds grow on almond trees; after the outer hull and shell are removed, the inner almond kernel is obtained.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The edible seed found inside the hard shell of an almond fruit. Almonds grow on almond trees; after the outer hull and shell are removed, the inner almond kernel is obtained.',
      'en'::text,
      'The edible seed found inside the hard shell of an almond fruit. Almonds grow on almond trees; after the outer hull and shell are removed, the inner almond kernel is obtained.',
      'بادام کے پھل کے سخت خول کے اندر پایا جانے والا کھانے کے قابل بیج۔ بادام کے درختوں پر اگتے ہیں؛ بیرونی چھلکا اور خول ہٹانے کے بعد اندرونی بادام کا مغز حاصل ہوتا ہے۔',
      'البذرة الصالحة للأكل الموجودة داخل القشرة الصلبة لثمرة اللوز. ينمو اللوز على الأشجار، ويتم الحصول على اللب الداخلي بعد إزالة الغلاف الخارجي والقشرة.',
      'دانه خوراکی موجود در داخل پوست سخت میوه بادام. بادام روی درختان بادام رشد می‌کند و پس از برداشتن پوسته بیرونی و پوست سخت، مغز آن به دست می‌آید.',
      'د بادام د مېوې د سخت پوښ دننه خوراکي زړی. بادام د بادامو په ونو کې وده کوي او د خارجي پوستکي او پوښ له لیرې کولو وروسته مغز ترلاسه کېږي.',
      '{"en":"The edible seed found inside the hard shell of an almond fruit. Almonds grow on almond trees; after the outer hull and shell are removed, the inner almond kernel is obtained.","ur":"بادام کے پھل کے سخت خول کے اندر پایا جانے والا کھانے کے قابل بیج۔ بادام کے درختوں پر اگتے ہیں؛ بیرونی چھلکا اور خول ہٹانے کے بعد اندرونی بادام کا مغز حاصل ہوتا ہے۔","ar":"البذرة الصالحة للأكل الموجودة داخل القشرة الصلبة لثمرة اللوز. ينمو اللوز على الأشجار، ويتم الحصول على اللب الداخلي بعد إزالة الغلاف الخارجي والقشرة.","fa":"دانه خوراکی موجود در داخل پوست سخت میوه بادام. بادام روی درختان بادام رشد می‌کند و پس از برداشتن پوسته بیرونی و پوست سخت، مغز آن به دست می‌آید.","ps":"د بادام د مېوې د سخت پوښ دننه خوراکي زړی. بادام د بادامو په ونو کې وده کوي او د خارجي پوستکي او پوښ له لیرې کولو وروسته مغز ترلاسه کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Almond In-Shell
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Almond In-Shell') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The almond seed kept inside its natural hard shell. Almonds grow on almond trees and develop inside a soft outer hull surrounding the shell.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The almond seed kept inside its natural hard shell. Almonds grow on almond trees and develop inside a soft outer hull surrounding the shell.',
      'en'::text,
      'The almond seed kept inside its natural hard shell. Almonds grow on almond trees and develop inside a soft outer hull surrounding the shell.',
      'بادام کا بیج جو اپنے قدرتی سخت خول میں محفوظ ہو۔ بادام کے درختوں پر اگتے ہیں اور خول کے گرد نرم بیرونی چھلکے کے اندر پروان چڑھتے ہیں۔',
      'بذرة اللوز المحفوظة داخل قشرتها الصلبة الطبيعية. ينمو اللوز على الأشجار ويتطور داخل غلاف خارجي ناعم يحيط بالقشرة.',
      'دانه بادام که درون پوست سخت طبیعی خود نگهداری می‌شود. بادام روی درخت رشد می‌کند و داخل یک پوسته بیرونی نرم که پوست سخت را احاطه کرده نمو می‌یابد.',
      'د بادام زړی چې په خپل طبیعي سخت پوښ کې ساتل شوی وي. بادام د بادامو په ونو کې د نرم خارجي پوستکي دننه وده کوي.',
      '{"en":"The almond seed kept inside its natural hard shell. Almonds grow on almond trees and develop inside a soft outer hull surrounding the shell.","ur":"بادام کا بیج جو اپنے قدرتی سخت خول میں محفوظ ہو۔ بادام کے درختوں پر اگتے ہیں اور خول کے گرد نرم بیرونی چھلکے کے اندر پروان چڑھتے ہیں۔","ar":"بذرة اللوز المحفوظة داخل قشرتها الصلبة الطبيعية. ينمو اللوز على الأشجار ويتطور داخل غلاف خارجي ناعم يحيط بالقشرة.","fa":"دانه بادام که درون پوست سخت طبیعی خود نگهداری می‌شود. بادام روی درخت رشد می‌کند و داخل یک پوسته بیرونی نرم که پوست سخت را احاطه کرده نمو می‌یابد.","ps":"د بادام زړی چې په خپل طبیعي سخت پوښ کې ساتل شوی وي. بادام د بادامو په ونو کې د نرم خارجي پوستکي دننه وده کوي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Pistachio Kernel
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Pistachio Kernel') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The edible inner seed of the pistachio fruit. Pistachios grow in clusters on pistachio trees; the outer hull and shell are removed to obtain the kernel.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The edible inner seed of the pistachio fruit. Pistachios grow in clusters on pistachio trees; the outer hull and shell are removed to obtain the kernel.',
      'en'::text,
      'The edible inner seed of the pistachio fruit. Pistachios grow in clusters on pistachio trees; the outer hull and shell are removed to obtain the kernel.',
      'پستے کے پھل کا کھانے کے قابل اندرونی بیج۔ پستہ کے درختوں پر گچھوں میں اگتے ہیں؛ مغز حاصل کرنے کے لیے بیرونی چھلکا اور خول ہٹا دیا جاتا ہے۔',
      'البذرة الداخلية الصالحة للأكل لثمرة الفستق. ينمو الفستق في عناقيد على الأشجار، ويتم نزع الغلاف الخارجي والقشرة للحصول على اللب.',
      'دانه خوراکی درونی میوه پسته. پسته به صورت خوشه‌ای روی درخت پسته رشد می‌کند و با جدا کردن پوسته بیرونی و پوست سخت، مغز آن به دست می‌آید.',
      'د پستې د مېوې خوراکي داخلي زړی. پسته د پستې په ونو کې په غوټیو کې وده کوي؛ د مغز ترلاسه کولو لپاره یې خارجي پوښ لیرې کېږي.',
      '{"en":"The edible inner seed of the pistachio fruit. Pistachios grow in clusters on pistachio trees; the outer hull and shell are removed to obtain the kernel.","ur":"پستے کے پھل کا کھانے کے قابل اندرونی بیج۔ پستہ کے درختوں پر گچھوں میں اگتے ہیں؛ مغز حاصل کرنے کے لیے بیرونی چھلکا اور خول ہٹا دیا جاتا ہے۔","ar":"البذرة الداخلية الصالحة للأكل لثمرة الفستق. ينمو الفستق في عناقيد على الأشجار، ويتم نزع الغلاف الخارجي والقشرة للحصول على اللب.","fa":"دانه خوراکی درونی میوه پسته. پسته به صورت خوشه‌ای روی درخت پسته رشد می‌کند و با جدا کردن پوسته بیرونی و پوست سخت، مغز آن به دست می‌آید.","ps":"د پستې د مېوې خوراکي داخلي زړی. پسته د پستې په ونو کې په غوټیو کې وده کوي؛ د مغز ترلاسه کولو لپاره یې خارجي پوښ لیرې کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Pistachio In-Shell
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Pistachio In-Shell') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The pistachio nut with its natural shell. It grows on a pistachio tree in clusters, and the shell commonly opens naturally as the nut matures.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The pistachio nut with its natural shell. It grows on a pistachio tree in clusters, and the shell commonly opens naturally as the nut matures.',
      'en'::text,
      'The pistachio nut with its natural shell. It grows on a pistachio tree in clusters, and the shell commonly opens naturally as the nut matures.',
      'پستہ اپنے قدرتی خول کے ساتھ۔ یہ درخت پر گچھوں میں اگتا ہے، اور پھل پکنے پر خول قدرتی طور پر خود بخود کھل جاتا ہے۔',
      'ثمرة الفستق بقشرتها الطبيعية. تنمو في عناقيد على شجرة الفستق، وتفتح القشرة طبيعيًا في الغالب عند نضج الثمرة.',
      'پسته با پوست سخت طبیعی. به صورت خوشه‌ای روی درخت پسته رشد می‌کند و پوست آن معمولاً هنگام رسیدن میوه به طور طبیعی خندان و باز می‌شود.',
      'پسته له خپل طبیعي پوښ سره. دا د پستې په ونه کې په غوټیو کې وده کوي، او د پخېدو پر مهال یې پوښ په طبیعي ډول خلاصیږي.',
      '{"en":"The pistachio nut with its natural shell. It grows on a pistachio tree in clusters, and the shell commonly opens naturally as the nut matures.","ur":"پستہ اپنے قدرتی خول کے ساتھ۔ یہ درخت پر گچھوں میں اگتا ہے، اور پھل پکنے پر خول قدرتی طور پر خود بخود کھل جاتا ہے۔","ar":"ثمرة الفستق بقشرتها الطبيعية. تنمو في عناقيد على شجرة الفستق، وتفتح القشرة طبيعيًا في الغالب عند نضج الثمرة.","fa":"پسته با پوست سخت طبیعی. به صورت خوشه‌ای روی درخت پسته رشد می‌کند و پوست آن معمولاً هنگام رسیدن میوه به طور طبیعی خندان و باز می‌شود.","ps":"پسته له خپل طبیعي پوښ سره. دا د پستې په ونه کې په غوټیو کې وده کوي، او د پخېدو پر مهال یې پوښ په طبیعي ډول خلاصیږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Cashew Kernel
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Cashew Kernel') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The edible seed of the cashew tree. The cashew nut grows externally at the bottom of the cashew apple; after processing and removing the hard shell, the kernel is obtained.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The edible seed of the cashew tree. The cashew nut grows externally at the bottom of the cashew apple; after processing and removing the hard shell, the kernel is obtained.',
      'en'::text,
      'The edible seed of the cashew tree. The cashew nut grows externally at the bottom of the cashew apple; after processing and removing the hard shell, the kernel is obtained.',
      'کاجو کے درخت کا کھانے کے قابل بیج۔ کاجو کا پھل بیرونی طور پر کاجو کے سیب کے نچلے حصے پر اگتا ہے؛ پروسیسنگ اور سخت خول ہٹانے کے بعد مغز حاصل ہوتا ہے۔',
      'البذرة الصالحة للأكل لشجرة الكاجو. تنمو الثمرة خارجيًا في أسفل تفاحة الكاجو، ويتم الحصول على اللب بعد المعالجة ونزع القشرة الصلبة.',
      'دانه خوراکی درخت کاشو. مغز کاجو در قسمت بیرونی و انتهای سیب کاشو رشد می‌کند و پس از فرآوری و حذف پوسته سخت به دست می‌آید.',
      'د کاجو د ونې خوراکي زړی. کاجو د کاجو د مڼې په لاندینۍ برخه کې بهر وده کوي؛ له پروسس او د پوښ له لیرې کولو وروسته مغز ترلاسه کېږي.',
      '{"en":"The edible seed of the cashew tree. The cashew nut grows externally at the bottom of the cashew apple; after processing and removing the hard shell, the kernel is obtained.","ur":"کاجو کے درخت کا کھانے کے قابل بیج۔ کاجو کا پھل بیرونی طور پر کاجو کے سیب کے نچلے حصے پر اگتا ہے؛ پروسیسنگ اور سخت خول ہٹانے کے بعد مغز حاصل ہوتا ہے۔","ar":"البذرة الصالحة للأكل لشجرة الكاجو. تنمو الثمرة خارجيًا في أسفل تفاحة الكاجو، ويتم الحصول على اللب بعد المعالجة ونزع القشرة الصلبة.","fa":"دانه خوراکی درخت کاشو. مغز کاجو در قسمت بیرونی و انتهای سیب کاشو رشد می‌کند و پس از فرآوری و حذف پوسته سخت به دست می‌آید.","ps":"د کاجو د ونې خوراکي زړی. کاجو د کاجو د مڼې په لاندینۍ برخه کې بهر وده کوي؛ له پروسس او د پوښ له لیرې کولو وروسته مغز ترلاسه کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Cashew In-Shell
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Cashew In-Shell') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The raw cashew nut with its natural shell. It grows attached to the lower end of the cashew apple on the cashew tree.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The raw cashew nut with its natural shell. It grows attached to the lower end of the cashew apple on the cashew tree.',
      'en'::text,
      'The raw cashew nut with its natural shell. It grows attached to the lower end of the cashew apple on the cashew tree.',
      'کچا کاجو اپنے قدرتی خول کے ساتھ۔ یہ درخت پر کاجو کے سیب کے نچلے سرے سے جڑا ہوا اگتا ہے۔',
      'حبة الكاجو الخام بقشرتها الطبيعية. تنمو متصلة بالطرف السفلي لتفاحة الكاجو على الشجرة.',
      'کاشوی خام با پوست سخت طبیعی. این میوه متصل به انتهای پایینی سیب کاشو روی درخت رشد می‌کند.',
      'خام کاجو له خپل طبیعي پوښ سره. دا د کاجو په ونه کې د کاجو د مڼې په ښکته برخه پورې نښتی وده کوي.',
      '{"en":"The raw cashew nut with its natural shell. It grows attached to the lower end of the cashew apple on the cashew tree.","ur":"کچا کاجو اپنے قدرتی خول کے ساتھ۔ یہ درخت پر کاجو کے سیب کے نچلے سرے سے جڑا ہوا اگتا ہے۔","ar":"حبة الكاجو الخام بقشرتها الطبيعية. تنمو متصلة بالطرف السفلي لتفاحة الكاجو على الشجرة.","fa":"کاشوی خام با پوست سخت طبیعی. این میوه متصل به انتهای پایینی سیب کاشو روی درخت رشد می‌کند.","ps":"خام کاجو له خپل طبیعي پوښ سره. دا د کاجو په ونه کې د کاجو د مڼې په ښکته برخه پورې نښتی وده کوي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Hazelnut Kernel
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Hazelnut Kernel') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The edible seed inside the hazelnut shell. Hazelnuts grow on hazel trees or shrubs and develop in clusters surrounded by leafy husks.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The edible seed inside the hazelnut shell. Hazelnuts grow on hazel trees or shrubs and develop in clusters surrounded by leafy husks.',
      'en'::text,
      'The edible seed inside the hazelnut shell. Hazelnuts grow on hazel trees or shrubs and develop in clusters surrounded by leafy husks.',
      'ہیزل نٹ (فندق) کے خول کے اندر کھانے کے قابل بیج۔ یہ درختوں یا جھاڑیوں پر گچھوں میں پتوں دار چھلکوں کے اندر پروان چڑھتے ہیں۔',
      'البذرة الصالحة للأكل داخل قشرة البندق. ينمو البندق على أشجار أو شجيرات البندق في عناقيد محاطة بأغلفة ورقية.',
      'دانه خوراکی داخل پوست فندق. فندق روی درختان یا بوته‌های فندق به صورت خوشه‌ای و در میان غلاف‌های برگ‌مانند رشد می‌کند.',
      'د فندق د پوښ دننه خوراکي زړی. فندق د فندق په ونو یا بوټو کې په غوټیو کې د پاڼیزو پوښونو دننه وده کوي.',
      '{"en":"The edible seed inside the hazelnut shell. Hazelnuts grow on hazel trees or shrubs and develop in clusters surrounded by leafy husks.","ur":"ہیزل نٹ (فندق) کے خول کے اندر کھانے کے قابل بیج۔ یہ درختوں یا جھاڑیوں پر گچھوں میں پتوں دار چھلکوں کے اندر پروان چڑھتے ہیں۔","ar":"البذرة الصالحة للأكل داخل قشرة البندق. ينمو البندق على أشجار أو شجيرات البندق في عناقيد محاطة بأغلفة ورقية.","fa":"دانه خوراکی داخل پوست فندق. فندق روی درختان یا بوته‌های فندق به صورت خوشه‌ای و در میان غلاف‌های برگ‌مانند رشد می‌کند.","ps":"د فندق د پوښ دننه خوراکي زړی. فندق د فندق په ونو یا بوټو کې په غوټیو کې د پاڼیزو پوښونو دننه وده کوي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Hazelnut In-Shell
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Hazelnut In-Shell') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The hazelnut fruit with its hard natural shell intact. It grows on hazel trees or shrubs in small clusters.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The hazelnut fruit with its hard natural shell intact. It grows on hazel trees or shrubs in small clusters.',
      'en'::text,
      'The hazelnut fruit with its hard natural shell intact. It grows on hazel trees or shrubs in small clusters.',
      'ہیزل نٹ (فندق) کا پھل اپنے مکمل سخت قدرتی خول کے ساتھ۔ یہ درختوں یا جھاڑیوں پر چھوٹے گچھوں میں اگتا ہے۔',
      'ثمرة البندق المحتفظة بقشرتها الطبيعية الصلبة. تنمو على أشجار أو شجيرات البندق في عناقيد صغيرة.',
      'میوه فندق با پوست سخت و طبیعی دست‌نخورده. روی درختچه‌ها یا بوته‌های فندق در خوشه‌های کوچک رشد می‌کند.',
      'د فندق مېوه له خپل بشپړ سخت طبیعي پوښ سره. دا د فندق په ونو یا بوټو کې په کوچنیو غوټیو کې وده کوي.',
      '{"en":"The hazelnut fruit with its hard natural shell intact. It grows on hazel trees or shrubs in small clusters.","ur":"ہیزل نٹ (فندق) کا پھل اپنے مکمل سخت قدرتی خول کے ساتھ۔ یہ درختوں یا جھاڑیوں پر چھوٹے گچھوں میں اگتا ہے۔","ar":"ثمرة البندق المحتفظة بقشرتها الطبيعية الصلبة. تنمو على أشجار أو شجيرات البندق في عناقيد صغيرة.","fa":"میوه فندق با پوست سخت و طبیعی دست‌نخورده. روی درختچه‌ها یا بوته‌های فندق در خوشه‌های کوچک رشد می‌کند.","ps":"د فندق مېوه له خپل بشپړ سخت طبیعي پوښ سره. دا د فندق په ونو یا بوټو کې په کوچنیو غوټیو کې وده کوي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Chestnut Kernel
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Chestnut Kernel') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The edible inner part of the chestnut. Chestnuts grow on chestnut trees inside a spiny outer burr; the burr and hard shell are removed to obtain the kernel.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The edible inner part of the chestnut. Chestnuts grow on chestnut trees inside a spiny outer burr; the burr and hard shell are removed to obtain the kernel.',
      'en'::text,
      'The edible inner part of the chestnut. Chestnuts grow on chestnut trees inside a spiny outer burr; the burr and hard shell are removed to obtain the kernel.',
      'شاہ بلوط (چیسٹ نٹ) کا کھانے کے قابل اندرونی حصہ۔ یہ درختوں پر خاردار بیرونی خول میں اگتے ہیں؛ خاردار چھلکا اور سخت خول ہٹانے پر مغز ملتا ہے۔',
      'الجزء الداخلي الصالح للأكل من الكستناء. تنمو على الأشجار داخل غلاف شوكي خارجي، ويتم الحصول على اللب بنزع الغلاف والقشرة الصلبة.',
      'بخش خوراکی درونی شاه‌بلوط. شاه‌بلوط درون پوسته خاردار بیرونی روی درخت رشد می‌کند و با جدا کردن خارها و پوست سخت، مغز آن به دست می‌آید.',
      'د کستنا (شاه بلوط) خوراکي داخلي برخه. دا په ونو کې د اغزن خارجي پوښ دننه وده کوي چې د هغې له لیرې کولو وروسته مغز ترلاسه کېږي.',
      '{"en":"The edible inner part of the chestnut. Chestnuts grow on chestnut trees inside a spiny outer burr; the burr and hard shell are removed to obtain the kernel.","ur":"شاہ بلوط (چیسٹ نٹ) کا کھانے کے قابل اندرونی حصہ۔ یہ درختوں پر خاردار بیرونی خول میں اگتے ہیں؛ خاردار چھلکا اور سخت خول ہٹانے پر مغز ملتا ہے۔","ar":"الجزء الداخلي الصالح للأكل من الكستناء. تنمو على الأشجار داخل غلاف شوكي خارجي، ويتم الحصول على اللب بنزع الغلاف والقشرة الصلبة.","fa":"بخش خوراکی درونی شاه‌بلوط. شاه‌بلوط درون پوسته خاردار بیرونی روی درخت رشد می‌کند و با جدا کردن خارها و پوست سخت، مغز آن به دست می‌آید.","ps":"د کستنا (شاه بلوط) خوراکي داخلي برخه. دا په ونو کې د اغزن خارجي پوښ دننه وده کوي چې د هغې له لیرې کولو وروسته مغز ترلاسه کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Chestnut In-Shell
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Chestnut In-Shell') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The mature chestnut with its natural hard shell. Chestnuts grow inside a spiny burr on large chestnut trees.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The mature chestnut with its natural hard shell. Chestnuts grow inside a spiny burr on large chestnut trees.',
      'en'::text,
      'The mature chestnut with its natural hard shell. Chestnuts grow inside a spiny burr on large chestnut trees.',
      'تیار شاہ بلوط اپنے قدرتی سخت خول کے ساتھ۔ یہ بڑے درختوں پر خاردار چھلکے کے اندر اگتے ہیں۔',
      'ثمرة الكستناء الناضجة بقشرتها الصلبة الطبيعية. تنمو داخل غلاف شوكي على أشجار الكستناء الكبيرة.',
      'شاه‌بلوط رسیده با پوست سخت طبیعی. درون پوسته خاردار روی درختان بزرگ شاه‌بلوط رشد می‌کند.',
      'پخه کستنا له خپل طبیعي سخت پوښ سره. دا د شاه بلوط په لویو ونو کې د اغزن پوښ دننه وده کوي.',
      '{"en":"The mature chestnut with its natural hard shell. Chestnuts grow inside a spiny burr on large chestnut trees.","ur":"تیار شاہ بلوط اپنے قدرتی سخت خول کے ساتھ۔ یہ بڑے درختوں پر خاردار چھلکے کے اندر اگتے ہیں۔","ar":"ثمرة الكستناء الناضجة بقشرتها الصلبة الطبيعية. تنمو داخل غلاف شوكي على أشجار الكستناء الكبيرة.","fa":"شاه‌بلوط رسیده با پوست سخت طبیعی. درون پوسته خاردار روی درختان بزرگ شاه‌بلوط رشد می‌کند.","ps":"پخه کستنا له خپل طبیعي سخت پوښ سره. دا د شاه بلوط په لویو ونو کې د اغزن پوښ دننه وده کوي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Brazil Nut Kernel
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Brazil Nut Kernel') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The edible seed of the Brazil nut tree. Several Brazil nuts develop inside a large, hard, round fruit capsule growing on very tall rainforest trees.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The edible seed of the Brazil nut tree. Several Brazil nuts develop inside a large, hard, round fruit capsule growing on very tall rainforest trees.',
      'en'::text,
      'The edible seed of the Brazil nut tree. Several Brazil nuts develop inside a large, hard, round fruit capsule growing on very tall rainforest trees.',
      'برازیل نٹ کے درخت کا کھانے کے قابل بیج۔ کئی برازیل نٹس بارانی جنگلات کے بلند درختوں پر ایک بڑے سخت گول پھل کے اندر تیار ہوتے ہیں۔',
      'البذرة الصالحة للأكل لشجرة الجوز البرازيلي. تنمو عدة حبات داخل كبسولة ثمرية كبيرة مستديرة وصلبة على أشجار الغابات المطيرة الشاهقة.',
      'دانه خوراکی درخت بادام برزیلی. چندین دانه درون یک کپسول میوه بزرگ، سخت و گرد روی درختان بسیار بلند جنگل‌های بارانی رشد می‌کنند.',
      'د برازیلي چارمغز د ونې خوراکي زړی. څو دانې د باراني ځنګلونو په لوړو ونو کې په یوه لوی، سخت او ګرد مېوه کې یوځای وده کوي.',
      '{"en":"The edible seed of the Brazil nut tree. Several Brazil nuts develop inside a large, hard, round fruit capsule growing on very tall rainforest trees.","ur":"برازیل نٹ کے درخت کا کھانے کے قابل بیج۔ کئی برازیل نٹس بارانی جنگلات کے بلند درختوں پر ایک بڑے سخت گول پھل کے اندر تیار ہوتے ہیں۔","ar":"البذرة الصالحة للأكل لشجرة الجوز البرازيلي. تنمو عدة حبات داخل كبسولة ثمرية كبيرة مستديرة وصلبة على أشجار الغابات المطيرة الشاهقة.","fa":"دانه خوراکی درخت بادام برزیلی. چندین دانه درون یک کپسول میوه بزرگ، سخت و گرد روی درختان بسیار بلند جنگل‌های بارانی رشد می‌کنند.","ps":"د برازیلي چارمغز د ونې خوراکي زړی. څو دانې د باراني ځنګلونو په لوړو ونو کې په یوه لوی، سخت او ګرد مېوه کې یوځای وده کوي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Brazil Nut In-Shell
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Brazil Nut In-Shell') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The Brazil nut seed with its hard shell intact. The nuts develop together inside a large woody fruit produced by the Brazil nut tree.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The Brazil nut seed with its hard shell intact. The nuts develop together inside a large woody fruit produced by the Brazil nut tree.',
      'en'::text,
      'The Brazil nut seed with its hard shell intact. The nuts develop together inside a large woody fruit produced by the Brazil nut tree.',
      'برازیل نٹ کا بیج اپنے سخت خول کے ساتھ۔ یہ نٹس درخت کے ایک بڑے لکڑی نما سخت پھل کے اندر ایک ساتھ پروان چڑھتے ہیں۔',
      'بذرة الجوز البرازيلي بقشرتها الصلبة السليمة. تنمو الحبات معًا داخل ثمرة خشبية كبيرة تنتجها الشجرة.',
      'دانه بادام برزیلی با پوست سخت دست‌نخورده. این دانه‌ها در کنار هم داخل یک میوه چوبی بزرگ درخت رشد می‌کنند.',
      'برازیلي چارمغز له خپل سخت پوښ سره. دا زړي د ونې د یوې لویې لرګینې مېوې دننه یوځای وده کوي.',
      '{"en":"The Brazil nut seed with its hard shell intact. The nuts develop together inside a large woody fruit produced by the Brazil nut tree.","ur":"برازیل نٹ کا بیج اپنے سخت خول کے ساتھ۔ یہ نٹس درخت کے ایک بڑے لکڑی نما سخت پھل کے اندر ایک ساتھ پروان چڑھتے ہیں۔","ar":"بذرة الجوز البرازيلي بقشرتها الصلبة السليمة. تنمو الحبات معًا داخل ثمرة خشبية كبيرة تنتجها الشجرة.","fa":"دانه بادام برزیلی با پوست سخت دست‌نخورده. این دانه‌ها در کنار هم داخل یک میوه چوبی بزرگ درخت رشد می‌کنند.","ps":"برازیلي چارمغز له خپل سخت پوښ سره. دا زړي د ونې د یوې لویې لرګینې مېوې دننه یوځای وده کوي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Macadamia Kernel
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Macadamia Kernel') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The edible inner seed of the macadamia fruit. Macadamia nuts grow on trees and are enclosed in a very hard shell covered by an outer green husk.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The edible inner seed of the macadamia fruit. Macadamia nuts grow on trees and are enclosed in a very hard shell covered by an outer green husk.',
      'en'::text,
      'The edible inner seed of the macadamia fruit. Macadamia nuts grow on trees and are enclosed in a very hard shell covered by an outer green husk.',
      'میکادیمیا پھل کا کھانے کے قابل اندرونی بیج۔ یہ درختوں پر اگتے ہیں اور سبز بیرونی چھلکے کے نیچے ایک انتہائی سخت خول میں بند ہوتے ہیں۔',
      'البذرة الداخلية الصالحة للأكل لثمرة المكاديميا. تنمو على الأشجار وتكون محاطة بقشرة صلبة للغاية يغطيها غلاف أخضر خارجي.',
      'دانه خوراکی درونی میوه ماکادمیا. روی درختان رشد کرده و درون یک پوست بسیار سخت با پوشش بیرونی سبز قرار دارد.',
      'د ماکادمیا د مېوې خوراکي داخلي زړی. دا په ونو کې وده کوي او د شنه خارجي پوستکي لاندې په ډېر سخت پوښ کې بند وي.',
      '{"en":"The edible inner seed of the macadamia fruit. Macadamia nuts grow on trees and are enclosed in a very hard shell covered by an outer green husk.","ur":"میکادیمیا پھل کا کھانے کے قابل اندرونی بیج۔ یہ درختوں پر اگتے ہیں اور سبز بیرونی چھلکے کے نیچے ایک انتہائی سخت خول میں بند ہوتے ہیں۔","ar":"البذرة الداخلية الصالحة للأكل لثمرة المكاديميا. تنمو على الأشجار وتكون محاطة بقشرة صلبة للغاية يغطيها غلاف أخضر خارجي.","fa":"دانه خوراکی درونی میوه ماکادمیا. روی درختان رشد کرده و درون یک پوست بسیار سخت با پوشش بیرونی سبز قرار دارد.","ps":"د ماکادمیا د مېوې خوراکي داخلي زړی. دا په ونو کې وده کوي او د شنه خارجي پوستکي لاندې په ډېر سخت پوښ کې بند وي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Macadamia In-Shell
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Macadamia In-Shell') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The macadamia nut with its extremely hard natural shell intact. It grows on the macadamia tree beneath an outer green husk.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The macadamia nut with its extremely hard natural shell intact. It grows on the macadamia tree beneath an outer green husk.',
      'en'::text,
      'The macadamia nut with its extremely hard natural shell intact. It grows on the macadamia tree beneath an outer green husk.',
      'میکادیمیا نٹ اپنے انتہائی سخت قدرتی خول کے ساتھ۔ یہ درخت پر سبز بیرونی چھلکے کے نیچے تیار ہوتا ہے۔',
      'حبة المكاديميا المحتفظة بقشرتها الطبيعية شديدة الصلابة. تنمو على الشجرة أسفل غلاف أخضر خارجي.',
      'ماکادمیا با پوست طبیعی بسیار سخت و دست‌نخورده. روی درخت ماکادمیا در زیر یک پوسته سبز بیرونی رشد می‌کند.',
      'ماکادمیا له خپل خورا سخت طبیعي پوښ سره. دا د ماکادمیا په ونه کې تر شنه خارجي پوښ لاندې وده کوي.',
      '{"en":"The macadamia nut with its extremely hard natural shell intact. It grows on the macadamia tree beneath an outer green husk.","ur":"میکادیمیا نٹ اپنے انتہائی سخت قدرتی خول کے ساتھ۔ یہ درخت پر سبز بیرونی چھلکے کے نیچے تیار ہوتا ہے۔","ar":"حبة المكاديميا المحتفظة بقشرتها الطبيعية شديدة الصلابة. تنمو على الشجرة أسفل غلاف أخضر خارجي.","fa":"ماکادمیا با پوست طبیعی بسیار سخت و دست‌نخورده. روی درخت ماکادمیا در زیر یک پوسته سبز بیرونی رشد می‌کند.","ps":"ماکادمیا له خپل خورا سخت طبیعي پوښ سره. دا د ماکادمیا په ونه کې تر شنه خارجي پوښ لاندې وده کوي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Pine Nut Kernel
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Pine Nut Kernel') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The edible seed obtained from certain species of pine trees. Pine nuts develop inside pine cones; the cone opens and the seeds are collected and shelled.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The edible seed obtained from certain species of pine trees. Pine nuts develop inside pine cones; the cone opens and the seeds are collected and shelled.',
      'en'::text,
      'The edible seed obtained from certain species of pine trees. Pine nuts develop inside pine cones; the cone opens and the seeds are collected and shelled.',
      'چلغوزے کا کھانے کے قابل مغز جو صنوبر کے درختوں سے حاصل ہوتا ہے۔ یہ صنوبر کے مخروطی پھل میں بنتے ہیں، جس کے کھلنے پر بیج نکال کر چھلکا اتارا جاتا ہے۔',
      'البذرة الصالحة للأكل المستخرجة من أنواع معينة من أشجار الصنوبر. تنمو داخل مخاريط الصنوبر؛ ويتم جمعها وتقشيرها بعد تفتح المخروط.',
      'مغز خوراکی دانه‌های کاج (چلغوز). درون مخروط‌های کاج تشکیل می‌شود و پس از باز شدن مخروط، دانه‌ها جمع‌آوری و پوست‌گیری می‌شوند.',
      'د جلغوزي خوراکي مغز چې د نښتر له ونو ترلاسه کېږي. دا د نښتر په غوټیو کې وده کوي او د غوټۍ له خلاصېدو وروسته راټول او پوست کېږي.',
      '{"en":"The edible seed obtained from certain species of pine trees. Pine nuts develop inside pine cones; the cone opens and the seeds are collected and shelled.","ur":"چلغوزے کا کھانے کے قابل مغز جو صنوبر کے درختوں سے حاصل ہوتا ہے۔ یہ صنوبر کے مخروطی پھل میں بنتے ہیں، جس کے کھلنے پر بیج نکال کر چھلکا اتارا جاتا ہے۔","ar":"البذرة الصالحة للأكل المستخرجة من أنواع معينة من أشجار الصنوبر. تنمو داخل مخاريط الصنوبر؛ ويتم جمعها وتقشيرها بعد تفتح المخروط.","fa":"مغز خوراکی دانه‌های کاج (چلغوز). درون مخروط‌های کاج تشکیل می‌شود و پس از باز شدن مخروط، دانه‌ها جمع‌آوری و پوست‌گیری می‌شوند.","ps":"د جلغوزي خوراکي مغز چې د نښتر له ونو ترلاسه کېږي. دا د نښتر په غوټیو کې وده کوي او د غوټۍ له خلاصېدو وروسته راټول او پوست کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Pine Nut In-Shell
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Pine Nut In-Shell') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The pine seed with its natural shell. The seeds develop between the scales of pine cones growing on pine trees.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The pine seed with its natural shell. The seeds develop between the scales of pine cones growing on pine trees.',
      'en'::text,
      'The pine seed with its natural shell. The seeds develop between the scales of pine cones growing on pine trees.',
      'چلغوزہ اپنے قدرتی خول کے ساتھ۔ یہ بیج صنوبر کے درختوں پر مخروطی پھل کی تہوں کے درمیان پروان چڑھتے ہیں۔',
      'بذرة الصنوبر بقشرتها الطبيعية. تتكون البذور بين حراشف مخاريط الصنوبر النامية على الأشجار.',
      'دانه چلغوز با پوست سخت طبیعی. این دانه‌ها میان فلس‌های مخروط کاج روی درختان کاج نمو می‌یابند.',
      'جلغوزی له خپل طبیعي پوښ سره. دا زړي د نښتر د ونو د مخروطي غوټیو د پردو په منځ کې وده کوي.',
      '{"en":"The pine seed with its natural shell. The seeds develop between the scales of pine cones growing on pine trees.","ur":"چلغوزہ اپنے قدرتی خول کے ساتھ۔ یہ بیج صنوبر کے درختوں پر مخروطی پھل کی تہوں کے درمیان پروان چڑھتے ہیں۔","ar":"بذرة الصنوبر بقشرتها الطبيعية. تتكون البذور بين حراشف مخاريط الصنوبر النامية على الأشجار.","fa":"دانه چلغوز با پوست سخت طبیعی. این دانه‌ها میان فلس‌های مخروط کاج روی درختان کاج نمو می‌یابند.","ps":"جلغوزی له خپل طبیعي پوښ سره. دا زړي د نښتر د ونو د مخروطي غوټیو د پردو په منځ کې وده کوي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Raisins
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Raisins') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Dried grapes produced from fruit growing in bunches on grape vines. Fresh grapes are harvested and naturally or mechanically dried to reduce moisture and create raisins.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Dried grapes produced from fruit growing in bunches on grape vines. Fresh grapes are harvested and naturally or mechanically dried to reduce moisture and create raisins.',
      'en'::text,
      'Dried grapes produced from fruit growing in bunches on grape vines. Fresh grapes are harvested and naturally or mechanically dried to reduce moisture and create raisins.',
      'خشک انگور (کشمش) جو انگور کی بیلوں پر گچھوں میں اگتے ہیں۔ تازہ انگوروں کو توڑ کر قدرتی یا مشینی طور پر خشک کر کے کشمش تیار کی جاتی ہے۔',
      'العنب المجفف الناتج من ثمار تنمو في عناقيد على كروم العنب. يُحصد العنب الطازج ويُجفف طبيعيًا أو ميكانيكيًا لتقليل الرطوبة وإنتاج الزبيب.',
      'کشمش حاصل از خشک کردن میوه انگور که روی تاک‌ها می‌روید. انگور تازه چیده شده و به صورت طبیعی یا صنعتی خشک می‌شود تا رطوبت آن کاهش یابد.',
      'ممیز یا وچ شوي انګور چې د تاکونو په غوټیو کې وده کوي. تازه انګور راټول او په طبیعي یا ماشیني ډول وچېږي ترڅو ممیز ترې جوړ شي.',
      '{"en":"Dried grapes produced from fruit growing in bunches on grape vines. Fresh grapes are harvested and naturally or mechanically dried to reduce moisture and create raisins.","ur":"خشک انگور (کشمش) جو انگور کی بیلوں پر گچھوں میں اگتے ہیں۔ تازہ انگوروں کو توڑ کر قدرتی یا مشینی طور پر خشک کر کے کشمش تیار کی جاتی ہے۔","ar":"العنب المجفف الناتج من ثمار تنمو في عناقيد على كروم العنب. يُحصد العنب الطازج ويُجفف طبيعيًا أو ميكانيكيًا لتقليل الرطوبة وإنتاج الزبيب.","fa":"کشمش حاصل از خشک کردن میوه انگور که روی تاک‌ها می‌روید. انگور تازه چیده شده و به صورت طبیعی یا صنعتی خشک می‌شود تا رطوبت آن کاهش یابد.","ps":"ممیز یا وچ شوي انګور چې د تاکونو په غوټیو کې وده کوي. تازه انګور راټول او په طبیعي یا ماشیني ډول وچېږي ترڅو ممیز ترې جوړ شي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Dried Figs
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Dried Figs') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Dried fruit of the fig tree. Figs grow directly on the branches of the fig tree and are harvested ripe before being dried to reduce moisture.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Dried fruit of the fig tree. Figs grow directly on the branches of the fig tree and are harvested ripe before being dried to reduce moisture.',
      'en'::text,
      'Dried fruit of the fig tree. Figs grow directly on the branches of the fig tree and are harvested ripe before being dried to reduce moisture.',
      'انجیر کے درخت کا خشک پھل۔ انجیر براہ راست درخت کی شاخوں پر اگتے ہیں اور پکنے پر توڑ کر نمی کم کرنے کے لیے خشک کیے جاتے ہیں۔',
      'الثمار المجففة لشجرة التين. ينمو التين مباشرة على أغصان الشجرة ويُحصد ناضجًا قبل تجفيفه لتقليل نسبة الرطوبة.',
      'میوه خشک شده درخت انجیر. انجیر مستقیماً روی شاخه‌های درخت می‌روید و پس از رسیدن، برداشت و برای کاهش رطوبت خشک می‌شود.',
      'د انځر د ونې وچ شوې مېوه. انځر په مستقیم ډول د ونې په ښاخونو کې نیسي او له پخېدو وروسته راټول او د رطوبت کمولو لپاره وچېږي.',
      '{"en":"Dried fruit of the fig tree. Figs grow directly on the branches of the fig tree and are harvested ripe before being dried to reduce moisture.","ur":"انجیر کے درخت کا خشک پھل۔ انجیر براہ راست درخت کی شاخوں پر اگتے ہیں اور پکنے پر توڑ کر نمی کم کرنے کے لیے خشک کیے جاتے ہیں۔","ar":"الثمار المجففة لشجرة التين. ينمو التين مباشرة على أغصان الشجرة ويُحصد ناضجًا قبل تجفيفه لتقليل نسبة الرطوبة.","fa":"میوه خشک شده درخت انجیر. انجیر مستقیماً روی شاخه‌های درخت می‌روید و پس از رسیدن، برداشت و برای کاهش رطوبت خشک می‌شود.","ps":"د انځر د ونې وچ شوې مېوه. انځر په مستقیم ډول د ونې په ښاخونو کې نیسي او له پخېدو وروسته راټول او د رطوبت کمولو لپاره وچېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Dates
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Dates') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Fruit of the date palm tree. Dates grow in large hanging clusters high on date palms and are harvested at different maturity stages before drying or packing.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Fruit of the date palm tree. Dates grow in large hanging clusters high on date palms and are harvested at different maturity stages before drying or packing.',
      'en'::text,
      'Fruit of the date palm tree. Dates grow in large hanging clusters high on date palms and are harvested at different maturity stages before drying or packing.',
      'کھجور کے درخت (نخل) کا پھل۔ کھجوریں درخت پر بڑے لٹکتے ہوئے گچھوں میں اگتی ہیں اور خشک یا پیک کرنے سے پہلے مختلف مراحل پر توڑی جاتی ہیں۔',
      'ثمار نخلة التمر. ينمو التمر في عناقيد معلقة كبيرة في أعلى النخيل ويُجنى في مراحل نضج مختلفة قبل تجفيفه أو تعبئته.',
      'میوه نخل خرما. خرما در خوشه‌های بزرگ آویزان در بالای نخل‌ها رشد می‌کند و در مراحل مختلف رسیدگی چیده شده و خشک یا بسته‌بندی می‌شود.',
      'د خرما مېوه. خرما د کجورې د ونې په لوړو ځوړندو غوټیو کې وده کوي او له پخېدو وروسته د وچولو او بسته بندۍ لپاره راټولېږي.',
      '{"en":"Fruit of the date palm tree. Dates grow in large hanging clusters high on date palms and are harvested at different maturity stages before drying or packing.","ur":"کھجور کے درخت (نخل) کا پھل۔ کھجوریں درخت پر بڑے لٹکتے ہوئے گچھوں میں اگتی ہیں اور خشک یا پیک کرنے سے پہلے مختلف مراحل پر توڑی جاتی ہیں۔","ar":"ثمار نخلة التمر. ينمو التمر في عناقيد معلقة كبيرة في أعلى النخيل ويُجنى في مراحل نضج مختلفة قبل تجفيفه أو تعبئته.","fa":"میوه نخل خرما. خرما در خوشه‌های بزرگ آویزان در بالای نخل‌ها رشد می‌کند و در مراحل مختلف رسیدگی چیده شده و خشک یا بسته‌بندی می‌شود.","ps":"د خرما مېوه. خرما د کجورې د ونې په لوړو ځوړندو غوټیو کې وده کوي او له پخېدو وروسته د وچولو او بسته بندۍ لپاره راټولېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Dried Apricot
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Dried Apricot') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The dried fruit of the apricot tree. Apricots grow on tree branches and contain one central stone; ripe fruit is harvested and dried whole or in halves.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The dried fruit of the apricot tree. Apricots grow on tree branches and contain one central stone; ripe fruit is harvested and dried whole or in halves.',
      'en'::text,
      'The dried fruit of the apricot tree. Apricots grow on tree branches and contain one central stone; ripe fruit is harvested and dried whole or in halves.',
      'خوبانی کے درخت کا خشک پھل۔ خوبانی شاخوں پر اگتی ہے اور اس میں ایک گٹھلی ہوتی ہے؛ پکے پھل کو توڑ کر سالم یا دو ٹکڑوں میں خشک کیا جاتا ہے۔',
      'الثمرة المجففة لشجرة المشمش. ينمو المشمش على الأغصان ويحتوي على نواة واحدة، وتُحصد الثمار الناضجة وتُجفف كاملة أو مقسومة نصفين.',
      'میوه خشک درخت زردآلو (برگه زردآلو). زردآلو روی شاخه‌ها رشد کرده و یک هسته دارد؛ میوه رسیده چیده شده و به صورت درسته یا نیمه خشک می‌شود.',
      'د زردالو وچ شوې مېوه. زردالو د ونې په ښاخونو نیسي او یو زړی لري؛ پخه مېوه راټولېږي او په پوره یا نیمه بڼه وچېږي.',
      '{"en":"The dried fruit of the apricot tree. Apricots grow on tree branches and contain one central stone; ripe fruit is harvested and dried whole or in halves.","ur":"خوبانی کے درخت کا خشک پھل۔ خوبانی شاخوں پر اگتی ہے اور اس میں ایک گٹھلی ہوتی ہے؛ پکے پھل کو توڑ کر سالم یا دو ٹکڑوں میں خشک کیا جاتا ہے۔","ar":"الثمرة المجففة لشجرة المشمش. ينمو المشمش على الأغصان ويحتوي على نواة واحدة، وتُحصد الثمار الناضجة وتُجفف كاملة أو مقسومة نصفين.","fa":"میوه خشک درخت زردآلو (برگه زردآلو). زردآلو روی شاخه‌ها رشد کرده و یک هسته دارد؛ میوه رسیده چیده شده و به صورت درسته یا نیمه خشک می‌شود.","ps":"د زردالو وچ شوې مېوه. زردالو د ونې په ښاخونو نیسي او یو زړی لري؛ پخه مېوه راټولېږي او په پوره یا نیمه بڼه وچېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Prunes
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Prunes') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Dried plums produced from selected plum varieties. Plums grow on trees and are dried after harvesting to create prunes.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Dried plums produced from selected plum varieties. Plums grow on trees and are dried after harvesting to create prunes.',
      'en'::text,
      'Dried plums produced from selected plum varieties. Plums grow on trees and are dried after harvesting to create prunes.',
      'خشک آلوبخارا جو آلوبخارے کی منتخب اقسام سے تیار کیا جاتا ہے۔ یہ درختوں پر اگتے ہیں اور کٹائی کے بعد خشک کر کے تیار کیے جاتے ہیں۔',
      'البرقوق المجفف الناتج من أصناف مختارة من ثمار البرقوق. تنمو الثمار على الأشجار وتُجفف بعد الحصاد لإنتاج القراصيا.',
      'آلوی خشک (آلوبخارا) حاصل از ارقام منتخب آلو. آلو روی درخت رشد می‌کند و پس از چیدن، خشک شده و برای مصارف غذایی آماده می‌شود.',
      'وچ الوبخارا چې د الوګانو له ځانګړو ډولونو جوړېږي. الوګان په ونو کې وده کوي او له راټولېدو وروسته وچېږي.',
      '{"en":"Dried plums produced from selected plum varieties. Plums grow on trees and are dried after harvesting to create prunes.","ur":"خشک آلوبخارا جو آلوبخارے کی منتخب اقسام سے تیار کیا جاتا ہے۔ یہ درختوں پر اگتے ہیں اور کٹائی کے بعد خشک کر کے تیار کیے جاتے ہیں۔","ar":"البرقوق المجفف الناتج من أصناف مختارة من ثمار البرقوق. تنمو الثمار على الأشجار وتُجفف بعد الحصاد لإنتاج القراصيا.","fa":"آلوی خشک (آلوبخارا) حاصل از ارقام منتخب آلو. آلو روی درخت رشد می‌کند و پس از چیدن، خشک شده و برای مصارف غذایی آماده می‌شود.","ps":"وچ الوبخارا چې د الوګانو له ځانګړو ډولونو جوړېږي. الوګان په ونو کې وده کوي او له راټولېدو وروسته وچېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Dried Apple
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Dried Apple') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Apple fruit from an apple tree that has been sliced, ring-cut, or otherwise prepared and dried to remove moisture.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Apple fruit from an apple tree that has been sliced, ring-cut, or otherwise prepared and dried to remove moisture.',
      'en'::text,
      'Apple fruit from an apple tree that has been sliced, ring-cut, or otherwise prepared and dried to remove moisture.',
      'سیب کے درخت کا پھل جسے قتلوں، چھلوں یا دیگر شکلوں میں کاٹ کر نمی ختم کرنے کے لیے خشک کیا گیا ہو۔',
      'ثمار التفاح المقطعة إلى شرائح أو حلقات والمجففة لإزالة الرطوبة منها.',
      'سیب درختی که به صورت ورقه‌ای، حلقه‌ای یا قطعه‌قطعه آماده شده و رطوبت آن برای نگهداری خشک شده است.',
      'د مڼې مېوه چې په حلقو یا ټوټو وېشل شوې او د رطوبت لیرې کولو لپاره وچه شوې وي.',
      '{"en":"Apple fruit from an apple tree that has been sliced, ring-cut, or otherwise prepared and dried to remove moisture.","ur":"سیب کے درخت کا پھل جسے قتلوں، چھلوں یا دیگر شکلوں میں کاٹ کر نمی ختم کرنے کے لیے خشک کیا گیا ہو۔","ar":"ثمار التفاح المقطعة إلى شرائح أو حلقات والمجففة لإزالة الرطوبة منها.","fa":"سیب درختی که به صورت ورقه‌ای، حلقه‌ای یا قطعه‌قطعه آماده شده و رطوبت آن برای نگهداری خشک شده است.","ps":"د مڼې مېوه چې په حلقو یا ټوټو وېشل شوې او د رطوبت لیرې کولو لپاره وچه شوې وي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Dry Peas
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Dry Peas') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Mature dry seeds of the pea plant. Peas grow inside pods on a low-growing legume plant; the pods are allowed to mature and dry before the seeds are collected.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Mature dry seeds of the pea plant. Peas grow inside pods on a low-growing legume plant; the pods are allowed to mature and dry before the seeds are collected.',
      'en'::text,
      'Mature dry seeds of the pea plant. Peas grow inside pods on a low-growing legume plant; the pods are allowed to mature and dry before the seeds are collected.',
      'مٹر کے پودے کے مکمل پکے ہوئے خشک بیج۔ مٹر چھوٹی پھلیوں میں اگتے ہیں؛ بیج جمع کرنے سے پہلے پھلیوں کو پودے پر ہی پکنے اور سوکھنے دیا جاتا ہے۔',
      'بذور البازلاء الجافة والناضجة. تنمو داخل قرون على نبات بقولي قصير؛ وتُترك القرون حتى تنضج وتجف تمامًا قبل حصادها.',
      'دانه‌های خشک و رسیده بوته نخودفرنگی. درون غلاف‌های گیاهی بوته‌ای رشد می‌کند و پیش از جمع‌آوری، اجازه داده می‌شود تا غلاف‌ها کاملاً خشک شوند.',
      'د مټرو پخه او وچه شوې دانې. مټر په بوټو کې په پلو کې وده کوي؛ له ټولولو مخکې پرېښودل کېږي چې په طبیعي ډول وچ شي.',
      '{"en":"Mature dry seeds of the pea plant. Peas grow inside pods on a low-growing legume plant; the pods are allowed to mature and dry before the seeds are collected.","ur":"مٹر کے پودے کے مکمل پکے ہوئے خشک بیج۔ مٹر چھوٹی پھلیوں میں اگتے ہیں؛ بیج جمع کرنے سے پہلے پھلیوں کو پودے پر ہی پکنے اور سوکھنے دیا جاتا ہے۔","ar":"بذور البازلاء الجافة والناضجة. تنمو داخل قرون على نبات بقولي قصير؛ وتُترك القرون حتى تنضج وتجف تمامًا قبل حصادها.","fa":"دانه‌های خشک و رسیده بوته نخودفرنگی. درون غلاف‌های گیاهی بوته‌ای رشد می‌کند و پیش از جمع‌آوری، اجازه داده می‌شود تا غلاف‌ها کاملاً خشک شوند.","ps":"د مټرو پخه او وچه شوې دانې. مټر په بوټو کې په پلو کې وده کوي؛ له ټولولو مخکې پرېښودل کېږي چې په طبیعي ډول وچ شي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Yellow Peas
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Yellow Peas') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Yellow-colored mature seeds produced inside pods of the pea plant. They are harvested after the plant and pods have dried.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Yellow-colored mature seeds produced inside pods of the pea plant. They are harvested after the plant and pods have dried.',
      'en'::text,
      'Yellow-colored mature seeds produced inside pods of the pea plant. They are harvested after the plant and pods have dried.',
      'پیلے رنگ کے پکے ہوئے بیج جو مٹر کی پھلیوں میں پیدا ہوتے ہیں۔ پودا اور پھلیاں سوکھ جانے کے بعد ان کی کٹائی کی جاتی ہے۔',
      'بذور صفراء ناضجة تُنتج داخل قرون نبات البازلاء. تُحصد بعد جفاف النبات والقرون بالكامل.',
      'دانه‌های رسیده زرد رنگ که داخل غلاف‌های بوته نخودفرنگی تولید می‌شوند و پس از خشک شدن بوته برداشت می‌گردند.',
      'ژېړ رنګه پخې دانې چې د مټرو په پلو کې تولیدېږي او د بوټي له وچېدو وروسته رېبل کېږي.',
      '{"en":"Yellow-colored mature seeds produced inside pods of the pea plant. They are harvested after the plant and pods have dried.","ur":"پیلے رنگ کے پکے ہوئے بیج جو مٹر کی پھلیوں میں پیدا ہوتے ہیں۔ پودا اور پھلیاں سوکھ جانے کے بعد ان کی کٹائی کی جاتی ہے۔","ar":"بذور صفراء ناضجة تُنتج داخل قرون نبات البازلاء. تُحصد بعد جفاف النبات والقرون بالكامل.","fa":"دانه‌های رسیده زرد رنگ که داخل غلاف‌های بوته نخودفرنگی تولید می‌شوند و پس از خشک شدن بوته برداشت می‌گردند.","ps":"ژېړ رنګه پخې دانې چې د مټرو په پلو کې تولیدېږي او د بوټي له وچېدو وروسته رېبل کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Green Peas
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Green Peas') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Green-colored mature dry seeds from pea pods. Unlike fresh green peas, these are allowed to mature and dry before harvesting.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Green-colored mature dry seeds from pea pods. Unlike fresh green peas, these are allowed to mature and dry before harvesting.',
      'en'::text,
      'Green-colored mature dry seeds from pea pods. Unlike fresh green peas, these are allowed to mature and dry before harvesting.',
      'سبز رنگ کے مکمل تیار خشک بیج۔ تازہ مٹر کے برعکس، انہیں کٹائی سے پہلے پودے پر مکمل پکنے اور سوکھنے دیا جاتا ہے۔',
      'بذور خضراء جافة وناضجة من قرون البازلاء. تُترك لتنضج وتجف على النبات قبل حصادها بخلاف البازلاء الطازجة.',
      'دانه‌های خشک و رسیده سبزرنگ از غلاف‌های نخودفرنگی. برخلاف نخودفرنگی تازه، این دانه‌ها تا زمان رسیدن و خشک شدن کامل روی بوته می‌مانند.',
      'شنه رنګه پخې وچې دانې. د تازه مټرو پر خلاف، دا دانې تر حاصل ټولولو مخکې په بوټي کې پخېدو او وچېدو ته پرېښودل کېږي.',
      '{"en":"Green-colored mature dry seeds from pea pods. Unlike fresh green peas, these are allowed to mature and dry before harvesting.","ur":"سبز رنگ کے مکمل تیار خشک بیج۔ تازہ مٹر کے برعکس، انہیں کٹائی سے پہلے پودے پر مکمل پکنے اور سوکھنے دیا جاتا ہے۔","ar":"بذور خضراء جافة وناضجة من قرون البازلاء. تُترك لتنضج وتجف على النبات قبل حصادها بخلاف البازلاء الطازجة.","fa":"دانه‌های خشک و رسیده سبزرنگ از غلاف‌های نخودفرنگی. برخلاف نخودفرنگی تازه، این دانه‌ها تا زمان رسیدن و خشک شدن کامل روی بوته می‌مانند.","ps":"شنه رنګه پخې وچې دانې. د تازه مټرو پر خلاف، دا دانې تر حاصل ټولولو مخکې په بوټي کې پخېدو او وچېدو ته پرېښودل کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Chickpeas
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Chickpeas') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Mature edible seeds of the chickpea plant. Chickpeas develop inside small pods on a short bushy legume plant, usually one or two seeds per pod.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Mature edible seeds of the chickpea plant. Chickpeas develop inside small pods on a short bushy legume plant, usually one or two seeds per pod.',
      'en'::text,
      'Mature edible seeds of the chickpea plant. Chickpeas develop inside small pods on a short bushy legume plant, usually one or two seeds per pod.',
      'چنے کے پودے کے کھانے کے قابل پکے ہوئے بیج۔ چنے ایک چھوٹے جھاڑی دار پودے کی پھلیوں میں اگتے ہیں، عام طور پر فی پھلی ایک یا دو بیج ہوتے ہیں۔',
      'البذور الصالحة للأكل لنبات الحمص. ينمو الحمص داخل قرون صغيرة على شجيرة بقولية قصيرة، بمعدل بذرة أو بذرتين في كل قرن.',
      'دانه‌های خوراکی رسیده بوته نخود. نخودها داخل غلاف‌های کوچک روی بوته‌های کوتاه رشد می‌کنند و معمولاً هر غلاف یک یا دو دانه دارد.',
      'د چڼو د بوټي پخې خوراکي دانې. چڼې د لنډو بوټو په کوچنیو پلو کې وده کوي چې عموماً په هر پلي کې یو یا دوه زړي وي.',
      '{"en":"Mature edible seeds of the chickpea plant. Chickpeas develop inside small pods on a short bushy legume plant, usually one or two seeds per pod.","ur":"چنے کے پودے کے کھانے کے قابل پکے ہوئے بیج۔ چنے ایک چھوٹے جھاڑی دار پودے کی پھلیوں میں اگتے ہیں، عام طور پر فی پھلی ایک یا دو بیج ہوتے ہیں۔","ar":"البذور الصالحة للأكل لنبات الحمص. ينمو الحمص داخل قرون صغيرة على شجيرة بقولية قصيرة، بمعدل بذرة أو بذرتين في كل قرن.","fa":"دانه‌های خوراکی رسیده بوته نخود. نخودها داخل غلاف‌های کوچک روی بوته‌های کوتاه رشد می‌کنند و معمولاً هر غلاف یک یا دو دانه دارد.","ps":"د چڼو د بوټي پخې خوراکي دانې. چڼې د لنډو بوټو په کوچنیو پلو کې وده کوي چې عموماً په هر پلي کې یو یا دوه زړي وي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Kabuli Chickpeas
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Kabuli Chickpeas') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Large, light-colored chickpea seeds grown inside pods on the chickpea plant. They are generally larger and smoother than Desi chickpeas.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Large, light-colored chickpea seeds grown inside pods on the chickpea plant. They are generally larger and smoother than Desi chickpeas.',
      'en'::text,
      'Large, light-colored chickpea seeds grown inside pods on the chickpea plant. They are generally larger and smoother than Desi chickpeas.',
      'کابلی چنے: بڑے اور ہلکے رنگ کے چنے کے بیج جو پودے کی پھلیوں میں اگتے ہیں۔ یہ عام طور پر دیسی چنے کے مقابلے میں بڑے اور ہموار ہوتے ہیں۔',
      'حمص كابولي: بذور حمص كبيرة الحجم وفاتحة اللون تنمو في قرون، وتتميز بحجمها الأكبر وسطحها الأكثر نعومة مقارنة بالحمص البلدي (الديسي).',
      'نخود کابلی: دانه‌های بزرگ و روشن نخود که در غلاف‌ها رشد می‌کنند و معمولاً نسبت به نخود دسی بزرگتر و پوست صاف‌تری دارند.',
      'کابلي چڼې: لویې او روښانه رنګه چڼې چې په پلو کې وده کوي او د دیسي چڼو په پرتله لویې او ښویې وي.',
      '{"en":"Large, light-colored chickpea seeds grown inside pods on the chickpea plant. They are generally larger and smoother than Desi chickpeas.","ur":"کابلی چنے: بڑے اور ہلکے رنگ کے چنے کے بیج جو پودے کی پھلیوں میں اگتے ہیں۔ یہ عام طور پر دیسی چنے کے مقابلے میں بڑے اور ہموار ہوتے ہیں۔","ar":"حمص كابولي: بذور حمص كبيرة الحجم وفاتحة اللون تنمو في قرون، وتتميز بحجمها الأكبر وسطحها الأكثر نعومة مقارنة بالحمص البلدي (الديسي).","fa":"نخود کابلی: دانه‌های بزرگ و روشن نخود که در غلاف‌ها رشد می‌کنند و معمولاً نسبت به نخود دسی بزرگتر و پوست صاف‌تری دارند.","ps":"کابلي چڼې: لویې او روښانه رنګه چڼې چې په پلو کې وده کوي او د دیسي چڼو په پرتله لویې او ښویې وي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Desi Chickpeas
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Desi Chickpeas') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Smaller, darker chickpea seeds grown inside pods of the chickpea plant. They normally have a rougher seed coat than Kabuli types.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Smaller, darker chickpea seeds grown inside pods of the chickpea plant. They normally have a rougher seed coat than Kabuli types.',
      'en'::text,
      'Smaller, darker chickpea seeds grown inside pods of the chickpea plant. They normally have a rougher seed coat than Kabuli types.',
      'دیسی چنے: چھوٹے اور گہرے رنگ کے چنے کے بیج جو پھلیوں میں اگتے ہیں۔ ان کا بیرونی چھلکا کابلی چنے کی نسبت کھردرا ہوتا ہے۔',
      'حمص ديسي (بلدي): بذور حمص أصغر حجمًا وأغمق لونًا، ولها قشرة خارجية خشنة مقارنة بالنوع الكابولي.',
      'نخود دسی: دانه‌های کوچکتر و تیره‌تر نخود که داخل غلاف بوته رشد می‌کنند و پوسته زبرتر و ضخیم‌تری نسبت به نخود کابلی دارند.',
      'دیسي چڼې: کوچنۍ او تور رنګه چڼې چې په پلو کې نیسي او پوټکی یې د کابلي چڼو په پرتله ناهمواره وي.',
      '{"en":"Smaller, darker chickpea seeds grown inside pods of the chickpea plant. They normally have a rougher seed coat than Kabuli types.","ur":"دیسی چنے: چھوٹے اور گہرے رنگ کے چنے کے بیج جو پھلیوں میں اگتے ہیں۔ ان کا بیرونی چھلکا کابلی چنے کی نسبت کھردرا ہوتا ہے۔","ar":"حمص ديسي (بلدي): بذور حمص أصغر حجمًا وأغمق لونًا، ولها قشرة خارجية خشنة مقارنة بالنوع الكابولي.","fa":"نخود دسی: دانه‌های کوچکتر و تیره‌تر نخود که داخل غلاف بوته رشد می‌کنند و پوسته زبرتر و ضخیم‌تری نسبت به نخود کابلی دارند.","ps":"دیسي چڼې: کوچنۍ او تور رنګه چڼې چې په پلو کې نیسي او پوټکی یې د کابلي چڼو په پرتله ناهمواره وي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Mung Beans
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Mung Beans') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Mature seeds of the mung bean plant. The beans grow inside long pods on a small legume plant and are harvested after the pods dry.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Mature seeds of the mung bean plant. The beans grow inside long pods on a small legume plant and are harvested after the pods dry.',
      'en'::text,
      'Mature seeds of the mung bean plant. The beans grow inside long pods on a small legume plant and are harvested after the pods dry.',
      'مونگ کے پودے کے پکے ہوئے بیج۔ یہ دال چھوٹے پودے پر لمبی پھلیوں کے اندر اگتی ہے اور پھلیاں سوکھنے پر کاٹی جاتی ہے۔',
      'بذور الماش (المونغ) الناضجة. تنمو داخل قرون طويلة على نبات بقولي صغير وتُحصد بعد جفاف القرون.',
      'دانه‌های رسیده گیاه ماش. ماش درون غلاف‌های باریک و طویل روی بوته رشد می‌کند و پس از خشک شدن غلاف‌ها برداشت می‌شود.',
      'د مۍ پخې دانې. دا لوبیا ډوله دانې په اوږدو پلو کې وده کوي او د پلو له وچېدو وروسته راټولېږي.',
      '{"en":"Mature seeds of the mung bean plant. The beans grow inside long pods on a small legume plant and are harvested after the pods dry.","ur":"مونگ کے پودے کے پکے ہوئے بیج۔ یہ دال چھوٹے پودے پر لمبی پھلیوں کے اندر اگتی ہے اور پھلیاں سوکھنے پر کاٹی جاتی ہے۔","ar":"بذور الماش (المونغ) الناضجة. تنمو داخل قرون طويلة على نبات بقولي صغير وتُحصد بعد جفاف القرون.","fa":"دانه‌های رسیده گیاه ماش. ماش درون غلاف‌های باریک و طویل روی بوته رشد می‌کند و پس از خشک شدن غلاف‌ها برداشت می‌شود.","ps":"د مۍ پخې دانې. دا لوبیا ډوله دانې په اوږدو پلو کې وده کوي او د پلو له وچېدو وروسته راټولېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Urad / Black Gram
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Urad / Black Gram') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Dark-colored mature seeds produced inside pods of the black gram legume plant. The dried pods are harvested and threshed to obtain the beans.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Dark-colored mature seeds produced inside pods of the black gram legume plant. The dried pods are harvested and threshed to obtain the beans.',
      'en'::text,
      'Dark-colored mature seeds produced inside pods of the black gram legume plant. The dried pods are harvested and threshed to obtain the beans.',
      'ماش / اڑد کی دال: سیاہ رنگ کے پکے ہوئے بیج جو پھلیوں میں پیدا ہوتے ہیں۔ خشک پھلیوں کو توڑ کر اور گاہ کر بیج حاصل کیے جاتے ہیں۔',
      'الماش الأسود (الأوراد): بذور ناضجة داكنة اللون تُنتج داخل قرون نبتة الأوراد البقولية وتُدرس القرون الجافة لاستخراجها.',
      'ماشک سیاه (اوراد): دانه‌های تیره و رسیده که درون غلاف‌های بوته رشد می‌کنند و پس از خرمن‌کوبی غلاف‌های خشک به دست می‌آیند.',
      'ماش (تور ماش): تور رنګه پخې دانې چې په پلو کې تولیدېږي او د پلو له وچېدو وروسته راایستل کېږي.',
      '{"en":"Dark-colored mature seeds produced inside pods of the black gram legume plant. The dried pods are harvested and threshed to obtain the beans.","ur":"ماش / اڑد کی دال: سیاہ رنگ کے پکے ہوئے بیج جو پھلیوں میں پیدا ہوتے ہیں۔ خشک پھلیوں کو توڑ کر اور گاہ کر بیج حاصل کیے جاتے ہیں۔","ar":"الماش الأسود (الأوراد): بذور ناضجة داكنة اللون تُنتج داخل قرون نبتة الأوراد البقولية وتُدرس القرون الجافة لاستخراجها.","fa":"ماشک سیاه (اوراد): دانه‌های تیره و رسیده که درون غلاف‌های بوته رشد می‌کنند و پس از خرمن‌کوبی غلاف‌های خشک به دست می‌آیند.","ps":"ماش (تور ماش): تور رنګه پخې دانې چې په پلو کې تولیدېږي او د پلو له وچېدو وروسته راایستل کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Adzuki Beans
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Adzuki Beans') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Small reddish beans produced inside pods of the adzuki bean plant. The plant is a legume and the mature dry seeds are harvested from dried pods.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Small reddish beans produced inside pods of the adzuki bean plant. The plant is a legume and the mature dry seeds are harvested from dried pods.',
      'en'::text,
      'Small reddish beans produced inside pods of the adzuki bean plant. The plant is a legume and the mature dry seeds are harvested from dried pods.',
      'لوبیا اذوکی: چھوٹے سرخ رنگ کے بیج جو اذوکی پودے کی پھلیوں میں پیدا ہوتے ہیں۔ سوکھی ہوئی پھلیوں سے مکمل پکے بیج نکالے جاتے ہیں۔',
      'فاصولياء أدزوكي: بذور حمراء صغيرة تُنتج داخل قرون نبات الأدزوكي البقولي وتُحصد بعد جفاف القرون.',
      'لوبیا آزوکی: دانه‌های سرخ‌رنگ کوچک که در غلاف‌های بوته آزوکی رشد کرده و پس از خشک شدن برداشت می‌شوند.',
      'ادزوکی لوبیا: کوچني سور رنګه زړي چې د پلو دننه وده کوي او د وچو پلو څخه راټولېږي.',
      '{"en":"Small reddish beans produced inside pods of the adzuki bean plant. The plant is a legume and the mature dry seeds are harvested from dried pods.","ur":"لوبیا اذوکی: چھوٹے سرخ رنگ کے بیج جو اذوکی پودے کی پھلیوں میں پیدا ہوتے ہیں۔ سوکھی ہوئی پھلیوں سے مکمل پکے بیج نکالے جاتے ہیں۔","ar":"فاصولياء أدزوكي: بذور حمراء صغيرة تُنتج داخل قرون نبات الأدزوكي البقولي وتُحصد بعد جفاف القرون.","fa":"لوبیا آزوکی: دانه‌های سرخ‌رنگ کوچک که در غلاف‌های بوته آزوکی رشد کرده و پس از خشک شدن برداشت می‌شوند.","ps":"ادزوکی لوبیا: کوچني سور رنګه زړي چې د پلو دننه وده کوي او د وچو پلو څخه راټولېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Kidney Beans
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Kidney Beans') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Kidney-shaped mature seeds grown inside pods of common bean plants. The pods mature and dry before the beans are removed.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Kidney-shaped mature seeds grown inside pods of common bean plants. The pods mature and dry before the beans are removed.',
      'en'::text,
      'Kidney-shaped mature seeds grown inside pods of common bean plants. The pods mature and dry before the beans are removed.',
      'گردے کی شکل کے پکے ہوئے بیج (راجما) جو پھلیوں کے اندر اگتے ہیں۔ بیج نکالنے سے پہلے پھلیوں کو پکنے اور سوکھنے دیا جاتا ہے۔',
      'فاصولياء كلوية: بذور ناضجة على شكل كلية تنمو داخل قرون الفاصولياء، وتُترك لتجف قبل استخراجها.',
      'لوبیا چیتی/قرمز کلیوی: دانه‌های کلیوی‌شکل که داخل غلاف‌های بوته لوبیا رشد می‌کنند و پیش از استخراج دانه‌ها، غلاف‌ها خشک می‌شوند.',
      'پښتورګي ډوله لوبیا (راجما): پخې دانې چې د پلو دننه وده کوي او له راایستلو مخکې وچېږي.',
      '{"en":"Kidney-shaped mature seeds grown inside pods of common bean plants. The pods mature and dry before the beans are removed.","ur":"گردے کی شکل کے پکے ہوئے بیج (راجما) جو پھلیوں کے اندر اگتے ہیں۔ بیج نکالنے سے پہلے پھلیوں کو پکنے اور سوکھنے دیا جاتا ہے۔","ar":"فاصولياء كلوية: بذور ناضجة على شكل كلية تنمو داخل قرون الفاصولياء، وتُترك لتجف قبل استخراجها.","fa":"لوبیا چیتی/قرمز کلیوی: دانه‌های کلیوی‌شکل که داخل غلاف‌های بوته لوبیا رشد می‌کنند و پیش از استخراج دانه‌ها، غلاف‌ها خشک می‌شوند.","ps":"پښتورګي ډوله لوبیا (راجما): پخې دانې چې د پلو دننه وده کوي او له راایستلو مخکې وچېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Red Kidney Beans
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Red Kidney Beans') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Red-colored kidney-shaped beans produced inside pods on a common bean plant and harvested as mature dry seeds.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Red-colored kidney-shaped beans produced inside pods on a common bean plant and harvested as mature dry seeds.',
      'en'::text,
      'Red-colored kidney-shaped beans produced inside pods on a common bean plant and harvested as mature dry seeds.',
      'سرخ راجما: سرخ رنگ کے گردے کی شکل کے بیج جو پھلیوں میں پیدا ہوتے ہیں اور مکمل خشک بیجوں کے طور پر کاٹے جاتے ہیں۔',
      'فاصولياء حمراء كلوية: بذور حمراء على شكل كلية تُنتج داخل القرون وتُحصد كبذور جافة وناضجة.',
      'لوبیا قرمز کلیوی: دانه‌های سرخ‌رنگ کلیوی‌شکل که درون غلاف‌ها نمو یافته و به عنوان دانه‌های خشک رسیده برداشت می‌شوند.',
      'سرخه لوبیا: پښتورګي ډوله سره زړي چې د پلو دننه تولیدېږي او د پخو وچو دانو په توګه رېبل کېږي.',
      '{"en":"Red-colored kidney-shaped beans produced inside pods on a common bean plant and harvested as mature dry seeds.","ur":"سرخ راجما: سرخ رنگ کے گردے کی شکل کے بیج جو پھلیوں میں پیدا ہوتے ہیں اور مکمل خشک بیجوں کے طور پر کاٹے جاتے ہیں۔","ar":"فاصولياء حمراء كلوية: بذور حمراء على شكل كلية تُنتج داخل القرون وتُحصد كبذور جافة وناضجة.","fa":"لوبیا قرمز کلیوی: دانه‌های سرخ‌رنگ کلیوی‌شکل که درون غلاف‌ها نمو یافته و به عنوان دانه‌های خشک رسیده برداشت می‌شوند.","ps":"سرخه لوبیا: پښتورګي ډوله سره زړي چې د پلو دننه تولیدېږي او د پخو وچو دانو په توګه رېبل کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- White Kidney Beans
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('White Kidney Beans') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'White kidney-shaped dry seeds produced inside bean pods on legume plants.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'White kidney-shaped dry seeds produced inside bean pods on legume plants.',
      'en'::text,
      'White kidney-shaped dry seeds produced inside bean pods on legume plants.',
      'سفید راجما: سفید رنگ کے گردے کی شکل کے خشک بیج جو پودے کی پھلیوں کے اندر پیدا ہوتے ہیں۔',
      'فاصولياء بيضاء كلوية: بذور جافة بيضاء اللون على شكل كلية تُنتج داخل قرون الفاصولياء.',
      'لوبیا سفید کلیوی: دانه‌های خشک سفیدرنگ و کلیوی‌شکل که در غلاف‌های بوته لوبیا به دست می‌آیند.',
      'سپینه لوبیا: پښتورګي ډوله سپینې وچې دانې چې د لوبیا د پلو دننه تولیدېږي.',
      '{"en":"White kidney-shaped dry seeds produced inside bean pods on legume plants.","ur":"سفید راجما: سفید رنگ کے گردے کی شکل کے خشک بیج جو پودے کی پھلیوں کے اندر پیدا ہوتے ہیں۔","ar":"فاصولياء بيضاء كلوية: بذور جافة بيضاء اللون على شكل كلية تُنتج داخل قرون الفاصولياء.","fa":"لوبیا سفید کلیوی: دانه‌های خشک سفیدرنگ و کلیوی‌شکل که در غلاف‌های بوته لوبیا به دست می‌آیند.","ps":"سپینه لوبیا: پښتورګي ډوله سپینې وچې دانې چې د لوبیا د پلو دننه تولیدېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Navy Beans
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Navy Beans') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Small white dry beans produced inside pods of the common bean plant. They are harvested after full maturity and drying.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Small white dry beans produced inside pods of the common bean plant. They are harvested after full maturity and drying.',
      'en'::text,
      'Small white dry beans produced inside pods of the common bean plant. They are harvested after full maturity and drying.',
      'نیوی بینز: چھوٹے سفید خشک لوبیا جو پھلیوں میں اگتے ہیں۔ مکمل پکنے اور سوکھنے کے بعد ان کی کٹائی کی جاتی ہے۔',
      'فاصولياء بيضاء صغيرة (نافي بينز): بذور فاصولياء جافة وصغيرة الحجم تُحصد بعد اكتمال النضج والجفاف.',
      'لوبیا سفید ریز (نیوی): دانه‌های کوچک و سفید خشک لوبیا که پس از رسیدن و خشک شدن کامل بوته برداشت می‌شوند.',
      'نیوي بینز (کوچنۍ سپینه لوبیا): کوچني سپین وچ زړي چې تر بشپړ پخېدو او وچېدو وروسته رېبل کېږي.',
      '{"en":"Small white dry beans produced inside pods of the common bean plant. They are harvested after full maturity and drying.","ur":"نیوی بینز: چھوٹے سفید خشک لوبیا جو پھلیوں میں اگتے ہیں۔ مکمل پکنے اور سوکھنے کے بعد ان کی کٹائی کی جاتی ہے۔","ar":"فاصولياء بيضاء صغيرة (نافي بينز): بذور فاصولياء جافة وصغيرة الحجم تُحصد بعد اكتمال النضج والجفاف.","fa":"لوبیا سفید ریز (نیوی): دانه‌های کوچک و سفید خشک لوبیا که پس از رسیدن و خشک شدن کامل بوته برداشت می‌شوند.","ps":"نیوي بینز (کوچنۍ سپینه لوبیا): کوچني سپین وچ زړي چې تر بشپړ پخېدو او وچېدو وروسته رېبل کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Pinto Beans
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Pinto Beans') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Speckled dry beans grown inside pods of common bean plants. The beans develop as seeds inside the pods and are harvested when dry.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Speckled dry beans grown inside pods of common bean plants. The beans develop as seeds inside the pods and are harvested when dry.',
      'en'::text,
      'Speckled dry beans grown inside pods of common bean plants. The beans develop as seeds inside the pods and are harvested when dry.',
      'چتکبرے لوبیا (پنٹو بینز): پھلیوں کے اندر اگنے والے چتکبرے بیج جو خشک ہونے پر کاٹے جاتے ہیں۔',
      'فاصولياء بينتو (المنقطة): بذور منقطة جافة تنمو داخل قرون نبات الفاصولياء وتُحصد عند تمام الجفاف.',
      'لوبیا چیتی (پینتو): دانه‌های خال‌دار خشک که در غلاف‌های لوبیا رشد کرده و هنگام خشکی بوته چیده می‌شوند.',
      'پینټو لوبیا (ټکي ټکي لوبیا): داغ لرونکې وچې دانې چې د پلو دننه وده کوي او د وچېدو پر مهال راټولېږي.',
      '{"en":"Speckled dry beans grown inside pods of common bean plants. The beans develop as seeds inside the pods and are harvested when dry.","ur":"چتکبرے لوبیا (پنٹو بینز): پھلیوں کے اندر اگنے والے چتکبرے بیج جو خشک ہونے پر کاٹے جاتے ہیں۔","ar":"فاصولياء بينتو (المنقطة): بذور منقطة جافة تنمو داخل قرون نبات الفاصولياء وتُحصد عند تمام الجفاف.","fa":"لوبیا چیتی (پینتو): دانه‌های خال‌دار خشک که در غلاف‌های لوبیا رشد کرده و هنگام خشکی بوته چیده می‌شوند.","ps":"پینټو لوبیا (ټکي ټکي لوبیا): داغ لرونکې وچې دانې چې د پلو دننه وده کوي او د وچېدو پر مهال راټولېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Black Beans
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Black Beans') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Black-colored mature seeds grown inside pods of bean plants. The dry pods are harvested and threshed for the beans.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Black-colored mature seeds grown inside pods of bean plants. The dry pods are harvested and threshed for the beans.',
      'en'::text,
      'Black-colored mature seeds grown inside pods of bean plants. The dry pods are harvested and threshed for the beans.',
      'سیاہ لوبیا: سیاہ رنگ کے پکے ہوئے بیج جو پھلیوں کے اندر اگتے ہیں۔ خشک پھلیوں کی کٹائی اور گہائی کر کے بیج الگ کیے جاتے ہیں۔',
      'فاصولياء سوداء: بذور ناضجة سوداء اللون تنمو داخل القرون، وتُحصد وتُدرس القرون الجافة لاستخراجها.',
      'لوبیا سیاه: دانه‌های رسیده سیاه‌رنگ که در غلاف‌های بوته لوبیا رشد می‌کنند و با خرمن‌کوبی غلاف‌ها جدا می‌شوند.',
      'توره لوبیا: تور رنګه پخې دانې چې د بوټو په پلو کې وده کوي او له وچو پلو څخه راایستل کېږي.',
      '{"en":"Black-colored mature seeds grown inside pods of bean plants. The dry pods are harvested and threshed for the beans.","ur":"سیاہ لوبیا: سیاہ رنگ کے پکے ہوئے بیج جو پھلیوں کے اندر اگتے ہیں۔ خشک پھلیوں کی کٹائی اور گہائی کر کے بیج الگ کیے جاتے ہیں۔","ar":"فاصولياء سوداء: بذور ناضجة سوداء اللون تنمو داخل القرون، وتُحصد وتُدرس القرون الجافة لاستخراجها.","fa":"لوبیا سیاه: دانه‌های رسیده سیاه‌رنگ که در غلاف‌های بوته لوبیا رشد می‌کنند و با خرمن‌کوبی غلاف‌ها جدا می‌شوند.","ps":"توره لوبیا: تور رنګه پخې دانې چې د بوټو په پلو کې وده کوي او له وچو پلو څخه راایستل کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Lima Beans
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Lima Beans') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Flat, broad seeds produced inside pods of the lima bean plant, a climbing or bush-type legume.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Flat, broad seeds produced inside pods of the lima bean plant, a climbing or bush-type legume.',
      'en'::text,
      'Flat, broad seeds produced inside pods of the lima bean plant, a climbing or bush-type legume.',
      'لیما بینز: چپٹے اور چوڑے بیج جو بیل دار یا جھاڑی دار پودے کی پھلیوں میں پیدا ہوتے ہیں۔',
      'فاصولياء ليمية: بذور عريضة ومفلطحة تُنتج داخل قرون نبتة الفاصولياء الليمية المتسلقة أو الشجيرية.',
      'لوبیا لیما: دانه‌های پهن و مسطح که در غلاف‌های بوته بالارونده یا بوته‌ای لیما تولید می‌شوند.',
      'لیما لوبیا: هوارې او پلنې دانې چې د خیژندونکي بوټي په پلو کې پیدا کېږي.',
      '{"en":"Flat, broad seeds produced inside pods of the lima bean plant, a climbing or bush-type legume.","ur":"لیما بینز: چپٹے اور چوڑے بیج جو بیل دار یا جھاڑی دار پودے کی پھلیوں میں پیدا ہوتے ہیں۔","ar":"فاصولياء ليمية: بذور عريضة ومفلطحة تُنتج داخل قرون نبتة الفاصولياء الليمية المتسلقة أو الشجيرية.","fa":"لوبیا لیما: دانه‌های پهن و مسطح که در غلاف‌های بوته بالارونده یا بوته‌ای لیما تولید می‌شوند.","ps":"لیما لوبیا: هوارې او پلنې دانې چې د خیژندونکي بوټي په پلو کې پیدا کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Cowpeas
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Cowpeas') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Mature seeds of the cowpea plant. Cowpeas develop inside long pods on a warm-climate legume plant.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Mature seeds of the cowpea plant. Cowpeas develop inside long pods on a warm-climate legume plant.',
      'en'::text,
      'Mature seeds of the cowpea plant. Cowpeas develop inside long pods on a warm-climate legume plant.',
      'روانگی / لوبیا: پودے کے پکے ہوئے بیج جو گرم موسم کے پودے کی لمبی پھلیوں کے اندر تیار ہوتے ہیں۔',
      'اللوبياء (عين البقرة): بذور ناضجة تنمو داخل قرون طويلة على نبات بقولي ينمو في المناطق الدافئة.',
      'لوبیا چشم‌بلبلی: دانه‌های رسیده که داخل غلاف‌های بلند روی بوته‌های اقلیم گرم نمو می‌یابند.',
      'لوبیا (کاو پیز): پخې دانې چې د ګرمې هوا د بوټو په اوږدو پلو کې وده کوي.',
      '{"en":"Mature seeds of the cowpea plant. Cowpeas develop inside long pods on a warm-climate legume plant.","ur":"روانگی / لوبیا: پودے کے پکے ہوئے بیج جو گرم موسم کے پودے کی لمبی پھلیوں کے اندر تیار ہوتے ہیں۔","ar":"اللوبياء (عين البقرة): بذور ناضجة تنمو داخل قرون طويلة على نبات بقولي ينمو في المناطق الدافئة.","fa":"لوبیا چشم‌بلبلی: دانه‌های رسیده که داخل غلاف‌های بلند روی بوته‌های اقلیم گرم نمو می‌یابند.","ps":"لوبیا (کاو پیز): پخې دانې چې د ګرمې هوا د بوټو په اوږدو پلو کې وده کوي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Black-Eyed Peas
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Black-Eyed Peas') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'A type of cowpea identified by a dark “eye” around the seed scar. The seeds grow inside pods on the cowpea plant.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'A type of cowpea identified by a dark “eye” around the seed scar. The seeds grow inside pods on the cowpea plant.',
      'en'::text,
      'A type of cowpea identified by a dark “eye” around the seed scar. The seeds grow inside pods on the cowpea plant.',
      'کالی آنکھ والی لوبیا (بلیک آئیڈ پیز): اس کی پہچان بیج کے نشان پر سیاہ آنکھ ہوتی ہے، جو لمبی پھلیوں میں اگتی ہے۔',
      'لوبياء ذات العين السوداء: صنف من اللوبياء يتميز ببقعة داكنة تشبه العين حول ندبة البذرة، وتنمو في قرون.',
      'لوبیا چشم‌بلبلی خال‌سیاه: نوعی لوبیا که با لکه سیاه چشم‌مانند روی دانه شناخته می‌شود و داخل غلاف‌ها رشد می‌کند.',
      'تورسترګې لوبیا: د لوبیا یو ډول چې پر زړي تور نښان لري او د بوټي په پلو کې نیسي.',
      '{"en":"A type of cowpea identified by a dark “eye” around the seed scar. The seeds grow inside pods on the cowpea plant.","ur":"کالی آنکھ والی لوبیا (بلیک آئیڈ پیز): اس کی پہچان بیج کے نشان پر سیاہ آنکھ ہوتی ہے، جو لمبی پھلیوں میں اگتی ہے۔","ar":"لوبياء ذات العين السوداء: صنف من اللوبياء يتميز ببقعة داكنة تشبه العين حول ندبة البذرة، وتنمو في قرون.","fa":"لوبیا چشم‌بلبلی خال‌سیاه: نوعی لوبیا که با لکه سیاه چشم‌مانند روی دانه شناخته می‌شود و داخل غلاف‌ها رشد می‌کند.","ps":"تورسترګې لوبیا: د لوبیا یو ډول چې پر زړي تور نښان لري او د بوټي په پلو کې نیسي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Lentils
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Lentils') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Small lens-shaped seeds produced inside short pods of the lentil plant. Lentils grow on a low, bushy legume plant.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Small lens-shaped seeds produced inside short pods of the lentil plant. Lentils grow on a low, bushy legume plant.',
      'en'::text,
      'Small lens-shaped seeds produced inside short pods of the lentil plant. Lentils grow on a low, bushy legume plant.',
      'مسور / دالیں: عدسہ نما چھوٹے بیج جو مسور کے چھوٹے جھاڑی دار پودے کی مختصر پھلیوں میں پیدا ہوتے ہیں۔',
      'العدس: بذور صغيرة عدسية الشكل تُنتج داخل قرون قصيرة لنبات العدس البقولي القصير.',
      'عدس: دانه‌های کوچک عدسی‌شکل که درون غلاف‌های کوتاه روی بوته‌های کوتاه عدس رشد می‌کنند.',
      'نسک: کوچنۍ عدسي ډوله دانې چې د نسکو د لنډو بوټو په کوچنیو پلو کې وده کوي.',
      '{"en":"Small lens-shaped seeds produced inside short pods of the lentil plant. Lentils grow on a low, bushy legume plant.","ur":"مسور / دالیں: عدسہ نما چھوٹے بیج جو مسور کے چھوٹے جھاڑی دار پودے کی مختصر پھلیوں میں پیدا ہوتے ہیں۔","ar":"العدس: بذور صغيرة عدسية الشكل تُنتج داخل قرون قصيرة لنبات العدس البقولي القصير.","fa":"عدس: دانه‌های کوچک عدسی‌شکل که درون غلاف‌های کوتاه روی بوته‌های کوتاه عدس رشد می‌کنند.","ps":"نسک: کوچنۍ عدسي ډوله دانې چې د نسکو د لنډو بوټو په کوچنیو پلو کې وده کوي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Red Lentils
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Red Lentils') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Red/orange lentil seeds produced inside small pods of the lentil plant; often sold whole or split.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Red/orange lentil seeds produced inside small pods of the lentil plant; often sold whole or split.',
      'en'::text,
      'Red/orange lentil seeds produced inside small pods of the lentil plant; often sold whole or split.',
      'سرخ مسور: سرخ/نارنجی رنگ کے بیج جو چھوٹی پھلیوں میں پیدا ہوتے ہیں؛ اکثر ثابت یا دھلی ہوئی دال کے طور پر فروخت ہوتے ہیں۔',
      'عدس أحمر: بذور عدس برتقالية أو حمراء تُنتج في قرون صغيرة؛ وتُباع عادةً كاملة أو مجروشة.',
      'عدس سرخ (دال عدس): دانه‌های نارنجی/قرمز عدس که داخل غلاف‌ها تولید شده و به صورت درسته یا لپه عرضه می‌شوند.',
      'سره نسک: سور یا نارنجي رنګه نسک چې په کوچنیو پلو کې پیدا کېږي؛ په پوره یا چاودلې بڼه پلورل کېږي.',
      '{"en":"Red/orange lentil seeds produced inside small pods of the lentil plant; often sold whole or split.","ur":"سرخ مسور: سرخ/نارنجی رنگ کے بیج جو چھوٹی پھلیوں میں پیدا ہوتے ہیں؛ اکثر ثابت یا دھلی ہوئی دال کے طور پر فروخت ہوتے ہیں۔","ar":"عدس أحمر: بذور عدس برتقالية أو حمراء تُنتج في قرون صغيرة؛ وتُباع عادةً كاملة أو مجروشة.","fa":"عدس سرخ (دال عدس): دانه‌های نارنجی/قرمز عدس که داخل غلاف‌ها تولید شده و به صورت درسته یا لپه عرضه می‌شوند.","ps":"سره نسک: سور یا نارنجي رنګه نسک چې په کوچنیو پلو کې پیدا کېږي؛ په پوره یا چاودلې بڼه پلورل کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Green Lentils
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Green Lentils') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Green-colored mature seeds from pods of the lentil plant, harvested after the plant has dried.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Green-colored mature seeds from pods of the lentil plant, harvested after the plant has dried.',
      'en'::text,
      'Green-colored mature seeds from pods of the lentil plant, harvested after the plant has dried.',
      'سبز مسور: مسور کی پھلیوں سے حاصل کردہ سبز پکے ہوئے بیج جو پودا سوکھنے کے بعد کاٹے جاتے ہیں۔',
      'عدس أخضر: بذور خضراء ناضجة تُستخرج من قرون نبات العدس بعد جفافه.',
      'عدس سبز: دانه‌های رسیده سبزرنگ از غلاف‌های عدس که پس از خشک شدن کامل بوته چیده می‌شوند.',
      'شنه نسک: د نسکو له پلو څخه شنه پخې دانې چې د بوټي له وچېدو وروسته راټولېږي.',
      '{"en":"Green-colored mature seeds from pods of the lentil plant, harvested after the plant has dried.","ur":"سبز مسور: مسور کی پھلیوں سے حاصل کردہ سبز پکے ہوئے بیج جو پودا سوکھنے کے بعد کاٹے جاتے ہیں۔","ar":"عدس أخضر: بذور خضراء ناضجة تُستخرج من قرون نبات العدس بعد جفافه.","fa":"عدس سبز: دانه‌های رسیده سبزرنگ از غلاف‌های عدس که پس از خشک شدن کامل بوته چیده می‌شوند.","ps":"شنه نسک: د نسکو له پلو څخه شنه پخې دانې چې د بوټي له وچېدو وروسته راټولېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Brown Lentils
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Brown Lentils') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Brown mature seeds produced inside pods of the lentil plant and dried naturally before harvesting.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Brown mature seeds produced inside pods of the lentil plant and dried naturally before harvesting.',
      'en'::text,
      'Brown mature seeds produced inside pods of the lentil plant and dried naturally before harvesting.',
      'بھورے مسور: بھورے رنگ کے پکے ہوئے بیج جو پھلیوں میں بنتے ہیں اور کٹائی سے پہلے قدرتی طور پر سوکھتے ہیں۔',
      'عدس بني: بذور بنية ناضجة تُنتج داخل قرون العدس وتُجفف طبيعيًا قبل الحصاد.',
      'عدس قهوه‌ای: دانه‌های قهوه‌ای رسیده که درون غلاف‌های عدس نمو یافته و به طور طبیعی خشک می‌شوند.',
      'نسواري نسک: نسواري پخې دانې چې د نسکو په پلو کې تولیدېږي او په طبیعي ډول وچېږي.',
      '{"en":"Brown mature seeds produced inside pods of the lentil plant and dried naturally before harvesting.","ur":"بھورے مسور: بھورے رنگ کے پکے ہوئے بیج جو پھلیوں میں بنتے ہیں اور کٹائی سے پہلے قدرتی طور پر سوکھتے ہیں۔","ar":"عدس بني: بذور بنية ناضجة تُنتج داخل قرون العدس وتُجفف طبيعيًا قبل الحصاد.","fa":"عدس قهوه‌ای: دانه‌های قهوه‌ای رسیده که درون غلاف‌های عدس نمو یافته و به طور طبیعی خشک می‌شوند.","ps":"نسواري نسک: نسواري پخې دانې چې د نسکو په پلو کې تولیدېږي او په طبیعي ډول وچېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Yellow Lentils
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Yellow Lentils') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Yellow-colored lentil seeds, commonly obtained after removing the outer seed coat from certain lentil varieties.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Yellow-colored lentil seeds, commonly obtained after removing the outer seed coat from certain lentil varieties.',
      'en'::text,
      'Yellow-colored lentil seeds, commonly obtained after removing the outer seed coat from certain lentil varieties.',
      'پیلے مسور: پیلے رنگ کی دال جو عموماً مخصوص اقسام کے بیرونی چھلکے اتارنے کے بعد حاصل کی جاتی ہے۔',
      'عدس أصفر: بذور عدس صفراء اللون، يتم الحصول عليها عادة بعد إزالة القشرة الخارجية من أصناف معينة.',
      'عدس زرد: دانه‌های زرد عدس که معمولاً پس از جدا کردن پوسته بیرونی ارقام خاصی به دست می‌آید.',
      'ژېړ نسک: ژېړ رنګه نسک چې عموماً د ځانګړو ډولونو د خارجي پوښ له لیرې کولو وروسته ترلاسه کېږي.',
      '{"en":"Yellow-colored lentil seeds, commonly obtained after removing the outer seed coat from certain lentil varieties.","ur":"پیلے مسور: پیلے رنگ کی دال جو عموماً مخصوص اقسام کے بیرونی چھلکے اتارنے کے بعد حاصل کی جاتی ہے۔","ar":"عدس أصفر: بذور عدس صفراء اللون، يتم الحصول عليها عادة بعد إزالة القشرة الخارجية من أصناف معينة.","fa":"عدس زرد: دانه‌های زرد عدس که معمولاً پس از جدا کردن پوسته بیرونی ارقام خاصی به دست می‌آید.","ps":"ژېړ نسک: ژېړ رنګه نسک چې عموماً د ځانګړو ډولونو د خارجي پوښ له لیرې کولو وروسته ترلاسه کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Black Lentils
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Black Lentils') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Small dark-colored lentil seeds produced inside pods on the lentil plant.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Small dark-colored lentil seeds produced inside pods on the lentil plant.',
      'en'::text,
      'Small dark-colored lentil seeds produced inside pods on the lentil plant.',
      'سیاہ مسور: چھوٹے سیاہ رنگ کے بیج جو مسور کے پودے کی پھلیوں کے اندر پیدا ہوتے ہیں۔',
      'عدس أسود (بيلوغا): بذور عدس صغيرة داكنة اللون تُنتج داخل قرون نبات العدس.',
      'عدس سیاه: دانه‌های کوچک و تیره‌رنگ عدس که درون غلاف‌های بوته رشد می‌کنند.',
      'تور نسک: کوچني تور رنګه زړي چې د نسکو د بوټي په پلو کې وده کوي.',
      '{"en":"Small dark-colored lentil seeds produced inside pods on the lentil plant.","ur":"سیاہ مسور: چھوٹے سیاہ رنگ کے بیج جو مسور کے پودے کی پھلیوں کے اندر پیدا ہوتے ہیں۔","ar":"عدس أسود (بيلوغا): بذور عدس صغيرة داكنة اللون تُنتج داخل قرون نبات العدس.","fa":"عدس سیاه: دانه‌های کوچک و تیره‌رنگ عدس که درون غلاف‌های بوته رشد می‌کنند.","ps":"تور نسک: کوچني تور رنګه زړي چې د نسکو د بوټي په پلو کې وده کوي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Broad / Fava Beans
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Broad / Fava Beans') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Large flat seeds produced inside thick pods on the fava bean plant, a tall upright legume.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Large flat seeds produced inside thick pods on the fava bean plant, a tall upright legume.',
      'en'::text,
      'Large flat seeds produced inside thick pods on the fava bean plant, a tall upright legume.',
      'باقلا / باقلی (فاوا بینز): موٹی پھلیوں میں پیدا ہونے والے بڑے چپٹے بیج جو ایک اونچے کھڑے پودے پر اگتے ہیں۔',
      'الفول العريض (الفول المدمس/الحبا): بذور كبيرة ومفلطحة تنمو داخل قرون سميكة على نبات الفول القائم.',
      'باقلا: دانه‌های بزرگ و پهن که درون غلاف‌های ضخیم بوته ایستاده باقلا تولید می‌شوند.',
      'باقلي: لویې هوارې دانې چې د لوړ بوټي په ډبلو پلو کې دننه تولیدېږي.',
      '{"en":"Large flat seeds produced inside thick pods on the fava bean plant, a tall upright legume.","ur":"باقلا / باقلی (فاوا بینز): موٹی پھلیوں میں پیدا ہونے والے بڑے چپٹے بیج جو ایک اونچے کھڑے پودے پر اگتے ہیں۔","ar":"الفول العريض (الفول المدمس/الحبا): بذور كبيرة ومفلطحة تنمو داخل قرون سميكة على نبات الفول القائم.","fa":"باقلا: دانه‌های بزرگ و پهن که درون غلاف‌های ضخیم بوته ایستاده باقلا تولید می‌شوند.","ps":"باقلي: لویې هوارې دانې چې د لوړ بوټي په ډبلو پلو کې دننه تولیدېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Pigeon Peas / Toor
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Pigeon Peas / Toor') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Mature seeds produced inside pods on the pigeon pea plant, which grows as a woody shrub-like legume.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Mature seeds produced inside pods on the pigeon pea plant, which grows as a woody shrub-like legume.',
      'en'::text,
      'Mature seeds produced inside pods on the pigeon pea plant, which grows as a woody shrub-like legume.',
      'ارہر / تور دال: پکے ہوئے بیج جو ارہر کے جھاڑی نما لکڑی والے پودے کی پھلیوں میں پیدا ہوتے ہیں۔',
      'البازلاء الحمامية (التور / طوار): بذور ناضجة تُنتج داخل قرون على شجيرة خشبية بقولية.',
      'نخود کفتری (دال تور): دانه‌های رسیده که در غلاف‌های شجیره‌ای چوبی دال تور رشد می‌کنند.',
      'ارهر (تور دال): پخې دانې چې د بوټي په پلو کې تولیدېږي او د دال لپاره کارول کېږي.',
      '{"en":"Mature seeds produced inside pods on the pigeon pea plant, which grows as a woody shrub-like legume.","ur":"ارہر / تور دال: پکے ہوئے بیج جو ارہر کے جھاڑی نما لکڑی والے پودے کی پھلیوں میں پیدا ہوتے ہیں۔","ar":"البازلاء الحمامية (التور / طوار): بذور ناضجة تُنتج داخل قرون على شجيرة خشبية بقولية.","fa":"نخود کفتری (دال تور): دانه‌های رسیده که در غلاف‌های شجیره‌ای چوبی دال تور رشد می‌کنند.","ps":"ارهر (تور دال): پخې دانې چې د بوټي په پلو کې تولیدېږي او د دال لپاره کارول کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Cassava
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Cassava') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'A large starchy storage root that grows underground from the cassava plant. The edible portion is dug out of the soil and can be dried, sliced, chipped, or processed into starch.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'A large starchy storage root that grows underground from the cassava plant. The edible portion is dug out of the soil and can be dried, sliced, chipped, or processed into starch.',
      'en'::text,
      'A large starchy storage root that grows underground from the cassava plant. The edible portion is dug out of the soil and can be dried, sliced, chipped, or processed into starch.',
      'کاساوا: نشاستے سے بھرپور ایک بڑی جڑ جو زمین کے نیچے اگتی ہے۔ خوردنی حصہ مٹی سے کھود کر نکالا جاتا ہے اور اسے سکھایا، کاٹا یا نشاستے میں تبدیل کیا جا سکتا ہے۔',
      'الكسافا: جذر نشوي كبير ينمو تحت الأرض لنبات الكسافا، ويُستخرج من التربة ويُجفف أو يُقطع لشرائح أو يُعالج لإنتاج النشا.',
      'کاساوا: ریشه غده‌ای و نشاسته‌ای بزرگ که در زیر خاک رشد می‌کند و پس از برداشت به صورت خشک، ورقه‌ای یا نشاسته فرآوری می‌شود.',
      'کاساوا: په نشایسته بډایه لویه ریښه چې تر ځمکې لاندې وده کوي؛ راایستل کېږي او وچېږي یا په نشایسته بدلېږي.',
      '{"en":"A large starchy storage root that grows underground from the cassava plant. The edible portion is dug out of the soil and can be dried, sliced, chipped, or processed into starch.","ur":"کاساوا: نشاستے سے بھرپور ایک بڑی جڑ جو زمین کے نیچے اگتی ہے۔ خوردنی حصہ مٹی سے کھود کر نکالا جاتا ہے اور اسے سکھایا، کاٹا یا نشاستے میں تبدیل کیا جا سکتا ہے۔","ar":"الكسافا: جذر نشوي كبير ينمو تحت الأرض لنبات الكسافا، ويُستخرج من التربة ويُجفف أو يُقطع لشرائح أو يُعالج لإنتاج النشا.","fa":"کاساوا: ریشه غده‌ای و نشاسته‌ای بزرگ که در زیر خاک رشد می‌کند و پس از برداشت به صورت خشک، ورقه‌ای یا نشاسته فرآوری می‌شود.","ps":"کاساوا: په نشایسته بډایه لویه ریښه چې تر ځمکې لاندې وده کوي؛ راایستل کېږي او وچېږي یا په نشایسته بدلېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Sweet Potato
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Sweet Potato') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'A swollen storage root that develops underground in the soil from the sweet potato vine. The edible root stores starch and natural sugars.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'A swollen storage root that develops underground in the soil from the sweet potato vine. The edible root stores starch and natural sugars.',
      'en'::text,
      'A swollen storage root that develops underground in the soil from the sweet potato vine. The edible root stores starch and natural sugars.',
      'شکر قندی: ایک موٹی جڑ جو زمین کے نیچے شکر قندی کی بیل سے اگتی ہے۔ یہ خوردنی جڑ قدرتی نشاستہ اور مٹھاس محفوظ رکھتی ہے۔',
      'البطاطا الحلوة: جذر درني متضخم ينمو تحت التربة من كرمة البطاطا الحلوة، ويخزن النشا والسكريات الطبيعية.',
      'سیب‌زمینی شیرین: ریشه ذخیره‌ای متورم که زیر خاک از بوته رونده رشد کرده و حاوی نشاسته و قندهای طبیعی است.',
      'شکرکنډي: یوه ډبله ریښه چې تر ځمکې لاندې وده کوي او نشایسته او طبیعي خواږه زېرمه کوي.',
      '{"en":"A swollen storage root that develops underground in the soil from the sweet potato vine. The edible root stores starch and natural sugars.","ur":"شکر قندی: ایک موٹی جڑ جو زمین کے نیچے شکر قندی کی بیل سے اگتی ہے۔ یہ خوردنی جڑ قدرتی نشاستہ اور مٹھاس محفوظ رکھتی ہے۔","ar":"البطاطا الحلوة: جذر درني متضخم ينمو تحت التربة من كرمة البطاطا الحلوة، ويخزن النشا والسكريات الطبيعية.","fa":"سیب‌زمینی شیرین: ریشه ذخیره‌ای متورم که زیر خاک از بوته رونده رشد کرده و حاوی نشاسته و قندهای طبیعی است.","ps":"شکرکنډي: یوه ډبله ریښه چې تر ځمکې لاندې وده کوي او نشایسته او طبیعي خواږه زېرمه کوي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Yam
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Yam') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'An underground starchy tuber produced by climbing plants of the Dioscorea group. The tuber develops below the soil and is dug up when mature.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'An underground starchy tuber produced by climbing plants of the Dioscorea group. The tuber develops below the soil and is dug up when mature.',
      'en'::text,
      'An underground starchy tuber produced by climbing plants of the Dioscorea group. The tuber develops below the soil and is dug up when mature.',
      'یم (رَتالو): نشاستے والی زیرِ زمین گانٹھ جو بیل دار پودوں سے پیدا ہوتی ہے۔ یہ گانٹھ مٹی کے نیچے پروان چڑھتی ہے اور پکنے پر کھودی جاتی ہے۔',
      'اليام (الديوسقوريا): درنة نشوية تنمو تحت الأرض لنباتات متسلقة، وتتطور تحت التربة وتُجنى بعد اكتمال النضج.',
      'سیب‌زمینی هندی (یام): غده نشاسته‌ای زیرزمینی که توسط گیاهان بالارونده تولید شده و پس از رسیدن از خاک بیرون آورده می‌شود.',
      'یام (رتالو): تر ځمکې لاندې نشایسته لرونکې غوټه چې د ختونکو بوټو لخوا جوړېږي او له پخېدو وروسته کیندل کېږي.',
      '{"en":"An underground starchy tuber produced by climbing plants of the Dioscorea group. The tuber develops below the soil and is dug up when mature.","ur":"یم (رَتالو): نشاستے والی زیرِ زمین گانٹھ جو بیل دار پودوں سے پیدا ہوتی ہے۔ یہ گانٹھ مٹی کے نیچے پروان چڑھتی ہے اور پکنے پر کھودی جاتی ہے۔","ar":"اليام (الديوسقوريا): درنة نشوية تنمو تحت الأرض لنباتات متسلقة، وتتطور تحت التربة وتُجنى بعد اكتمال النضج.","fa":"سیب‌زمینی هندی (یام): غده نشاسته‌ای زیرزمینی که توسط گیاهان بالارونده تولید شده و پس از رسیدن از خاک بیرون آورده می‌شود.","ps":"یام (رتالو): تر ځمکې لاندې نشایسته لرونکې غوټه چې د ختونکو بوټو لخوا جوړېږي او له پخېدو وروسته کیندل کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Taro
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Taro') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'An underground corm produced by the taro plant. The large starchy corm grows below ground while broad leaves grow above the soil.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'An underground corm produced by the taro plant. The large starchy corm grows below ground while broad leaves grow above the soil.',
      'en'::text,
      'An underground corm produced by the taro plant. The large starchy corm grows below ground while broad leaves grow above the soil.',
      'اروی (ٹارو): پودے کا زیرِ زمین تنا (گانٹھ)۔ یہ نشاستے دار گانٹھ زمین کے نیچے اگتی ہے جبکہ چوڑے پتے زمین کے اوپر پھیلتے ہیں۔',
      'القلقاس: كورمة نشوية تنمو تحت الأرض لنبات القلقاس، بينما تنمو الأوراق العريضة فوق سطح التربة.',
      'تارو (قلقاس): ساقه زیرزمینی غده‌ای و نشاسته‌ای بوته تارو که در زیر خاک نمو یافته و برگ‌های پهن آن بیرون از خاک می‌رویند.',
      'اروۍ (ټارو): تر ځمکې لاندې نشایسته لرونکې غوټه چې تر خاورې لاندې نیسي او لویې پاڼې یې بهر غوړېږي.',
      '{"en":"An underground corm produced by the taro plant. The large starchy corm grows below ground while broad leaves grow above the soil.","ur":"اروی (ٹارو): پودے کا زیرِ زمین تنا (گانٹھ)۔ یہ نشاستے دار گانٹھ زمین کے نیچے اگتی ہے جبکہ چوڑے پتے زمین کے اوپر پھیلتے ہیں۔","ar":"القلقاس: كورمة نشوية تنمو تحت الأرض لنبات القلقاس، بينما تنمو الأوراق العريضة فوق سطح التربة.","fa":"تارو (قلقاس): ساقه زیرزمینی غده‌ای و نشاسته‌ای بوته تارو که در زیر خاک نمو یافته و برگ‌های پهن آن بیرون از خاک می‌رویند.","ps":"اروۍ (ټارو): تر ځمکې لاندې نشایسته لرونکې غوټه چې تر خاورې لاندې نیسي او لویې پاڼې یې بهر غوړېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Yautia / Cocoyam
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Yautia / Cocoyam') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'An edible underground corm and cormels produced by the Xanthosoma-type plant. The usable starchy portion develops beneath the soil.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'An edible underground corm and cormels produced by the Xanthosoma-type plant. The usable starchy portion develops beneath the soil.',
      'en'::text,
      'An edible underground corm and cormels produced by the Xanthosoma-type plant. The usable starchy portion develops beneath the soil.',
      'یاوتیا / کوکو یم: نشاستے دار زیرِ زمین گانٹھیں جو پودے کی جڑوں میں مٹی کے نیچے پروان چڑھتی ہیں۔',
      'ياوتيا (كوكويام): كورمات نشوية صالحة للأكل تنمو تحت الأرض لنباتات من فصيلة الزانثوسوما.',
      'یائوتیا / کوکویام: بخش خوراکی غده‌ای و نشاسته‌ای که در زیر خاک از گیاهان نوع زانتوسوما رشد می‌کند.',
      'یاوتیا / کوکویام: تر ځمکې لاندې نشایسته لرونکې خوراکي غوټې چې د خاورې لاندې وده کوي.',
      '{"en":"An edible underground corm and cormels produced by the Xanthosoma-type plant. The usable starchy portion develops beneath the soil.","ur":"یاوتیا / کوکو یم: نشاستے دار زیرِ زمین گانٹھیں جو پودے کی جڑوں میں مٹی کے نیچے پروان چڑھتی ہیں۔","ar":"ياوتيا (كوكويام): كورمات نشوية صالحة للأكل تنمو تحت الأرض لنباتات من فصيلة الزانثوسوما.","fa":"یائوتیا / کوکویام: بخش خوراکی غده‌ای و نشاسته‌ای که در زیر خاک از گیاهان نوع زانتوسوما رشد می‌کند.","ps":"یاوتیا / کوکویام: تر ځمکې لاندې نشایسته لرونکې خوراکي غوټې چې د خاورې لاندې وده کوي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Arrowroot
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Arrowroot') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'A starch-rich underground rhizome produced by the arrowroot plant. The rhizomes are dug from the soil and commonly processed for starch.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'A starch-rich underground rhizome produced by the arrowroot plant. The rhizomes are dug from the soil and commonly processed for starch.',
      'en'::text,
      'A starch-rich underground rhizome produced by the arrowroot plant. The rhizomes are dug from the soil and commonly processed for starch.',
      'اراروٹ: نشاستے سے بھرپور زیرِ زمین جڑ (رائیزوم)۔ ان جڑوں کو مٹی سے کھود کر باریک نشاستہ تیار کرنے کے لیے پروسیس کیا جاتا ہے۔',
      'الأروروت (نشا المرانتا): جذمور غني بالنشا ينمو تحت الأرض، يُستخرج من التربة ويُعالج لإنتاج نشا ناعم وممتاز.',
      'آروروت (مارانتا): ریزوم زیرزمینی سرشار از نشاسته که از خاک برداشت شده و برای استخراج نشاسته مرغوب فرآوری می‌شود.',
      'اراروت: په نشایسته بډایه تر ځمکې لاندې ریښه چې له خاورې ایستل کېږي او د سپینې نشایستې لپاره پروسس کېږي.',
      '{"en":"A starch-rich underground rhizome produced by the arrowroot plant. The rhizomes are dug from the soil and commonly processed for starch.","ur":"اراروٹ: نشاستے سے بھرپور زیرِ زمین جڑ (رائیزوم)۔ ان جڑوں کو مٹی سے کھود کر باریک نشاستہ تیار کرنے کے لیے پروسیس کیا جاتا ہے۔","ar":"الأروروت (نشا المرانتا): جذمور غني بالنشا ينمو تحت الأرض، يُستخرج من التربة ويُعالج لإنتاج نشا ناعم وممتاز.","fa":"آروروت (مارانتا): ریزوم زیرزمینی سرشار از نشاسته که از خاک برداشت شده و برای استخراج نشاسته مرغوب فرآوری می‌شود.","ps":"اراروت: په نشایسته بډایه تر ځمکې لاندې ریښه چې له خاورې ایستل کېږي او د سپینې نشایستې لپاره پروسس کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Jerusalem Artichoke
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Jerusalem Artichoke') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'An underground edible tuber produced by a tall sunflower-related plant. The tubers develop in the soil around the plant''s roots.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'An underground edible tuber produced by a tall sunflower-related plant. The tubers develop in the soil around the plant''s roots.',
      'en'::text,
      'An underground edible tuber produced by a tall sunflower-related plant. The tubers develop in the soil around the plant''s roots.',
      'یروشلم آرٹچوک: سورج مکھی سے مشابہ ایک لمبے پودے کی زیرِ زمین خوردنی گانٹھ جو جڑوں کے گرد مٹی میں اگتی ہے۔',
      'طرطوفة (عين شمس الدرنية): درنة صالحة للأكل تنمو تحت الأرض حول جذور نبات طويل من فصيلة دوار الشمس.',
      'سیب‌زمینی ترشی (آرتیشو اورشلیم): غده خوراکی زیرزمینی که در اطراف ریشه‌های گیاهی شبیه به آفتابگردان رشد می‌کند.',
      'د اورشلیم آرټیکوک: تر ځمکې لاندې خوراکي غوټه چې د لمرګلي پورې تړلي بوټي په ریښو کې تولیدېږي.',
      '{"en":"An underground edible tuber produced by a tall sunflower-related plant. The tubers develop in the soil around the plant''s roots.","ur":"یروشلم آرٹچوک: سورج مکھی سے مشابہ ایک لمبے پودے کی زیرِ زمین خوردنی گانٹھ جو جڑوں کے گرد مٹی میں اگتی ہے۔","ar":"طرطوفة (عين شمس الدرنية): درنة صالحة للأكل تنمو تحت الأرض حول جذور نبات طويل من فصيلة دوار الشمس.","fa":"سیب‌زمینی ترشی (آرتیشو اورشلیم): غده خوراکی زیرزمینی که در اطراف ریشه‌های گیاهی شبیه به آفتابگردان رشد می‌کند.","ps":"د اورشلیم آرټیکوک: تر ځمکې لاندې خوراکي غوټه چې د لمرګلي پورې تړلي بوټي په ریښو کې تولیدېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Salep Root
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Salep Root') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Underground tubers of certain orchid plants. The tubers are collected, dried, and traditionally ground for use in food and beverages.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Underground tubers of certain orchid plants. The tubers are collected, dried, and traditionally ground for use in food and beverages.',
      'en'::text,
      'Underground tubers of certain orchid plants. The tubers are collected, dried, and traditionally ground for use in food and beverages.',
      'ثعلب (سالپ روٹ): مخصوص آرکڈ پودوں کی زیرِ زمین گانٹھیں جنہیں جمع کر کے خشک کیا جاتا ہے اور کھانوں و مشروبات میں سفوف کے طور پر استعمال کیا جاتا ہے۔',
      'جذور السحلب: درنات تنمو تحت الأرض لنباتات السحلب (الأوركيد)، تُجمع وتُجفف وتُطحن تقليديًا لصناعة الأطعمة والمشروبات.',
      'ثعلب: غده‌های زیرزمینی گونه‌های خاصی از ارکیده که برداشت و خشک شده و برای غلیظ کردن نوشیدنی‌ها و بستنی پودر می‌شود.',
      'ثعلب (د سالپ ریښه): د ځانګړو ارکید بوټو تر ځمکې لاندې غوټې چې راټولېږي، وچېږي او په خوړو او مشروباتو کې کارول کېږي.',
      '{"en":"Underground tubers of certain orchid plants. The tubers are collected, dried, and traditionally ground for use in food and beverages.","ur":"ثعلب (سالپ روٹ): مخصوص آرکڈ پودوں کی زیرِ زمین گانٹھیں جنہیں جمع کر کے خشک کیا جاتا ہے اور کھانوں و مشروبات میں سفوف کے طور پر استعمال کیا جاتا ہے۔","ar":"جذور السحلب: درنات تنمو تحت الأرض لنباتات السحلب (الأوركيد)، تُجمع وتُجفف وتُطحن تقليديًا لصناعة الأطعمة والمشروبات.","fa":"ثعلب: غده‌های زیرزمینی گونه‌های خاصی از ارکیده که برداشت و خشک شده و برای غلیظ کردن نوشیدنی‌ها و بستنی پودر می‌شود.","ps":"ثعلب (د سالپ ریښه): د ځانګړو ارکید بوټو تر ځمکې لاندې غوټې چې راټولېږي، وچېږي او په خوړو او مشروباتو کې کارول کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Other Roots & Tubers
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Other Roots & Tubers') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Other edible underground plant parts such as roots, tubers, corms, or rhizomes that store starch or similar nutrients beneath the soil.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Other edible underground plant parts such as roots, tubers, corms, or rhizomes that store starch or similar nutrients beneath the soil.',
      'en'::text,
      'Other edible underground plant parts such as roots, tubers, corms, or rhizomes that store starch or similar nutrients beneath the soil.',
      'دیگر جڑیں اور گانٹھیں: پودوں کے دیگر خوردنی زیرِ زمین حصے جیسے جڑیں، ٹیوبرز یا رائیزومز جو مٹی کے نیچے نشاستہ اور غذائیت محفوظ کرتے ہیں۔',
      'جذور ودرنات أخرى: أجزاء نباتية أخرى صالحة للأكل تنمو تحت الأرض مثل الجذور والدرنات والكورمات التي تخزن النشا والمغذيات.',
      'سایر ریشه‌ها و غده‌ها: سایر بخش‌های خوراکی زیرزمینی گیاهان مانند ریشه‌ها، پیازها و غده‌ها که نشاسته ذخیره می‌کنند.',
      'نورې ریښې او غوټې: د بوټو نور تر ځمکې لاندې خوراکي برخې لکه ریښې او غوټې چې نشایسته زېرمه کوي.',
      '{"en":"Other edible underground plant parts such as roots, tubers, corms, or rhizomes that store starch or similar nutrients beneath the soil.","ur":"دیگر جڑیں اور گانٹھیں: پودوں کے دیگر خوردنی زیرِ زمین حصے جیسے جڑیں، ٹیوبرز یا رائیزومز جو مٹی کے نیچے نشاستہ اور غذائیت محفوظ کرتے ہیں۔","ar":"جذور ودرنات أخرى: أجزاء نباتية أخرى صالحة للأكل تنمو تحت الأرض مثل الجذور والدرنات والكورمات التي تخزن النشا والمغذيات.","fa":"سایر ریشه‌ها و غده‌ها: سایر بخش‌های خوراکی زیرزمینی گیاهان مانند ریشه‌ها، پیازها و غده‌ها که نشاسته ذخیره می‌کنند.","ps":"نورې ریښې او غوټې: د بوټو نور تر ځمکې لاندې خوراکي برخې لکه ریښې او غوټې چې نشایسته زېرمه کوي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Black Pepper Whole
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Black Pepper Whole') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Dried berries of the black pepper climbing vine. The berries grow in hanging spikes and are harvested before full ripening, then dried until dark and wrinkled.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Dried berries of the black pepper climbing vine. The berries grow in hanging spikes and are harvested before full ripening, then dried until dark and wrinkled.',
      'en'::text,
      'Dried berries of the black pepper climbing vine. The berries grow in hanging spikes and are harvested before full ripening, then dried until dark and wrinkled.',
      'ثابت کالی مرچ: کالی مرچ کی بیل کے خشک دانے۔ یہ خوشوں کی شکل میں اگتے ہیں اور مکمل پکنے سے پہلے توڑ کر سیاہ اور جھری دار ہونے تک سکھائے جاتے ہیں۔',
      'فلفل أسود حب: ثمار مجففة لنبتة الفلفل الأسود المتسلقة. تنمو في سنابل متدلية وتُحصد قبل النضج الكامل ثم تُجفف حتى تصبح سوداء ومجعدة.',
      'فلفل سیاه درسته (دانه فلفل): دانه‌های خشک شده بوته بالارونده فلفل سیاه که قبل از رسیدن کامل چیده شده و تا سیاه و چروکیده شدن خشک می‌شوند.',
      'تور مرچ پوره (دانه): د تور مرچ د ختونکي بوټي وچې شوې دانې چې مخکې له پوره پخېدو راټولېږي او تر تورېدو او وچېدو پورې ساتل کېږي.',
      '{"en":"Dried berries of the black pepper climbing vine. The berries grow in hanging spikes and are harvested before full ripening, then dried until dark and wrinkled.","ur":"ثابت کالی مرچ: کالی مرچ کی بیل کے خشک دانے۔ یہ خوشوں کی شکل میں اگتے ہیں اور مکمل پکنے سے پہلے توڑ کر سیاہ اور جھری دار ہونے تک سکھائے جاتے ہیں۔","ar":"فلفل أسود حب: ثمار مجففة لنبتة الفلفل الأسود المتسلقة. تنمو في سنابل متدلية وتُحصد قبل النضج الكامل ثم تُجفف حتى تصبح سوداء ومجعدة.","fa":"فلفل سیاه درسته (دانه فلفل): دانه‌های خشک شده بوته بالارونده فلفل سیاه که قبل از رسیدن کامل چیده شده و تا سیاه و چروکیده شدن خشک می‌شوند.","ps":"تور مرچ پوره (دانه): د تور مرچ د ختونکي بوټي وچې شوې دانې چې مخکې له پوره پخېدو راټولېږي او تر تورېدو او وچېدو پورې ساتل کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Black Pepper Ground
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Black Pepper Ground') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Powder made by grinding dried black pepper berries harvested from the pepper vine.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Powder made by grinding dried black pepper berries harvested from the pepper vine.',
      'en'::text,
      'Powder made by grinding dried black pepper berries harvested from the pepper vine.',
      'پسی ہوئی کالی مرچ: کالی مرچ کی بیل سے توڑے گئے خشک دانوں کو پیس کر تیار کردہ باریک سفوف۔',
      'فلفل أسود مطحون: مسحوق ناتج عن طحن ثمار الفلفل الأسود المجففة والمحصول عليها من نبتة الفلفل.',
      'فلفل سیاه آسیاب‌شده: پودر حاصل از آسیاب کردن دانه‌های خشک فلفل سیاه چیده شده از بوته.',
      'میده شوي تور مرچ: اوړه یا پوډر چې د تور مرچ د وچو دانو له میده کولو څخه جوړېږي.',
      '{"en":"Powder made by grinding dried black pepper berries harvested from the pepper vine.","ur":"پسی ہوئی کالی مرچ: کالی مرچ کی بیل سے توڑے گئے خشک دانوں کو پیس کر تیار کردہ باریک سفوف۔","ar":"فلفل أسود مطحون: مسحوق ناتج عن طحن ثمار الفلفل الأسود المجففة والمحصول عليها من نبتة الفلفل.","fa":"فلفل سیاه آسیاب‌شده: پودر حاصل از آسیاب کردن دانه‌های خشک فلفل سیاه چیده شده از بوته.","ps":"میده شوي تور مرچ: اوړه یا پوډر چې د تور مرچ د وچو دانو له میده کولو څخه جوړېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Red Chilli Whole
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Red Chilli Whole') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Mature chilli fruit produced on Capsicum plants. The ripe red fruits are harvested and dried whole.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Mature chilli fruit produced on Capsicum plants. The ripe red fruits are harvested and dried whole.',
      'en'::text,
      'Mature chilli fruit produced on Capsicum plants. The ripe red fruits are harvested and dried whole.',
      'ثابت سرخ مرچ: مرچ کے پودے پر اگنے والا پکا ہوا پھل۔ سرخ رنگ کے پھل کو توڑ کر مکمل سالم حالت میں خشک کیا جاتا ہے۔',
      'فلفل أحمر حار كامل (حب): ثمار الفلفل الحار الناضجة لنبات الكابسيكوم، تُحصد الثمار الحمراء وتُجفف كاملة.',
      'فلفل قرمز درسته: میوه رسیده و تند فلفل قرمز که چیده شده و به صورت کامل و درسته خشک می‌شود.',
      'سره مرچ پوره: د مرچکو د بوټي پخه مېوه چې سرخه راټولېږي او په پوره توګه وچېږي.',
      '{"en":"Mature chilli fruit produced on Capsicum plants. The ripe red fruits are harvested and dried whole.","ur":"ثابت سرخ مرچ: مرچ کے پودے پر اگنے والا پکا ہوا پھل۔ سرخ رنگ کے پھل کو توڑ کر مکمل سالم حالت میں خشک کیا جاتا ہے۔","ar":"فلفل أحمر حار كامل (حب): ثمار الفلفل الحار الناضجة لنبات الكابسيكوم، تُحصد الثمار الحمراء وتُجفف كاملة.","fa":"فلفل قرمز درسته: میوه رسیده و تند فلفل قرمز که چیده شده و به صورت کامل و درسته خشک می‌شود.","ps":"سره مرچ پوره: د مرچکو د بوټي پخه مېوه چې سرخه راټولېږي او په پوره توګه وچېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Red Chilli Powder
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Red Chilli Powder') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Powder obtained by grinding dried mature red chilli fruits, with or without part of the seeds.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Powder obtained by grinding dried mature red chilli fruits, with or without part of the seeds.',
      'en'::text,
      'Powder obtained by grinding dried mature red chilli fruits, with or without part of the seeds.',
      'سرخ مرچ پاؤڈر: خشک پکی ہوئی سرخ مرچوں کو بیج سمیت یا بغیر پیس کر تیار کیا گیا سفوف۔',
      'شطة حمراء مطحونة (فلفل أحمر ناعم): مسحوق يُستحصل عليه بطحن ثمار الفلفل الأحمر الجافة، مع أو بدون بذورها.',
      'پودر فلفل قرمز: گرد حاصل از آسیاب کردن میوه‌های خشک و رسیده فلفل قرمز به همراه یا بدون دانه‌ها.',
      'د سرو مرچو پوډر: میده شوي سره مرچ چې د وچو پخو سرو مرچکو له میده کولو څخه ترلاسه کېږي.',
      '{"en":"Powder obtained by grinding dried mature red chilli fruits, with or without part of the seeds.","ur":"سرخ مرچ پاؤڈر: خشک پکی ہوئی سرخ مرچوں کو بیج سمیت یا بغیر پیس کر تیار کیا گیا سفوف۔","ar":"شطة حمراء مطحونة (فلفل أحمر ناعم): مسحوق يُستحصل عليه بطحن ثمار الفلفل الأحمر الجافة، مع أو بدون بذورها.","fa":"پودر فلفل قرمز: گرد حاصل از آسیاب کردن میوه‌های خشک و رسیده فلفل قرمز به همراه یا بدون دانه‌ها.","ps":"د سرو مرچو پوډر: میده شوي سره مرچ چې د وچو پخو سرو مرچکو له میده کولو څخه ترلاسه کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Paprika Whole
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Paprika Whole') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Mature red Capsicum fruit grown on pepper plants and dried after harvesting. Usually selected for color and relatively mild flavor.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Mature red Capsicum fruit grown on pepper plants and dried after harvesting. Usually selected for color and relatively mild flavor.',
      'en'::text,
      'Mature red Capsicum fruit grown on pepper plants and dried after harvesting. Usually selected for color and relatively mild flavor.',
      'ثابت پپریکا: شملہ مرچ کے خاندان کا پکا ہوا سرخ پھل جسے کٹائی کے بعد سکھایا جاتا ہے۔ عموماً رنگ اور ہلکے ذائقے کے لیے منتخب کیا جاتا ہے۔',
      'بابريكا كاملة: ثمار فلفل أحمر ناضجة تُزرع وتُجفف بعد الحصاد، وتُختار عادة للونها الزاهي ونكهتها المعتدلة غير الحارة.',
      'پاپریکا درسته: فلفل شیرین و رسیده قرمز از جنس کپسیکوم که پس از برداشت برای رنگ و طعم ملایم خشک می‌شود.',
      'پپریکا پوره: د کپسیکم پخه سرخه مېوه چې له راټولېدو وروسته د رنګ او ملایم خوند لپاره وچېږي.',
      '{"en":"Mature red Capsicum fruit grown on pepper plants and dried after harvesting. Usually selected for color and relatively mild flavor.","ur":"ثابت پپریکا: شملہ مرچ کے خاندان کا پکا ہوا سرخ پھل جسے کٹائی کے بعد سکھایا جاتا ہے۔ عموماً رنگ اور ہلکے ذائقے کے لیے منتخب کیا جاتا ہے۔","ar":"بابريكا كاملة: ثمار فلفل أحمر ناضجة تُزرع وتُجفف بعد الحصاد، وتُختار عادة للونها الزاهي ونكهتها المعتدلة غير الحارة.","fa":"پاپریکا درسته: فلفل شیرین و رسیده قرمز از جنس کپسیکوم که پس از برداشت برای رنگ و طعم ملایم خشک می‌شود.","ps":"پپریکا پوره: د کپسیکم پخه سرخه مېوه چې له راټولېدو وروسته د رنګ او ملایم خوند لپاره وچېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Paprika Powder
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Paprika Powder') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Fine powder made by grinding dried paprika-type Capsicum fruits.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Fine powder made by grinding dried paprika-type Capsicum fruits.',
      'en'::text,
      'Fine powder made by grinding dried paprika-type Capsicum fruits.',
      'پپریکا پاؤڈر: پپریکا قسم کے خشک سرخ پھلوں کو پیس کر تیار کردہ باریک خوش رنگ سفوف۔',
      'مسحوق البابريكا: بودرة ناعمة تُصنع بطحن ثمار الفلفل الأحمر المجففة من صنف البابريكا.',
      'پودر پاپریکا: پودر نرم تهیه شده از آسیاب دانه‌های خشک فلفل قرمز شیرین پاپریکا.',
      'د پپریکا پوډر: نرم پوډر چې د پپریکا د وچې مېوې له میده کولو جوړېږي.',
      '{"en":"Fine powder made by grinding dried paprika-type Capsicum fruits.","ur":"پپریکا پاؤڈر: پپریکا قسم کے خشک سرخ پھلوں کو پیس کر تیار کردہ باریک خوش رنگ سفوف۔","ar":"مسحوق البابريكا: بودرة ناعمة تُصنع بطحن ثمار الفلفل الأحمر المجففة من صنف البابريكا.","fa":"پودر پاپریکا: پودر نرم تهیه شده از آسیاب دانه‌های خشک فلفل قرمز شیرین پاپریکا.","ps":"د پپریکا پوډر: نرم پوډر چې د پپریکا د وچې مېوې له میده کولو جوړېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Cinnamon Whole
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Cinnamon Whole') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Dried inner bark obtained from cinnamon trees. Bark is peeled from stems or branches and curls into quills as it dries.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Dried inner bark obtained from cinnamon trees. Bark is peeled from stems or branches and curls into quills as it dries.',
      'en'::text,
      'Dried inner bark obtained from cinnamon trees. Bark is peeled from stems or branches and curls into quills as it dries.',
      'دارچینی ثابت: دارچینی کے درخت کے تنوں یا شاخوں سے اتاری گئی اندرونی چھال جو سوکھنے پر نلی نما گھنگھریالی ہو جاتی ہے۔',
      'قرفة أعواد (دارسين): اللحاء الداخلي المجفف المستخرج من أشجار القرفة، يُقشر ويلتف على شكل لفائف أسطوانية عند جفافه.',
      'دارچین درسته (چوب دارچین): پوسته درونی خشک شده تنه یا شاخه‌های درخت دارچین که هنگام خشک شدن لوله می‌شود.',
      'پوره دارچیني (ډکي): د دارچیني د ونې د ښاخونو وچ شوی داخلي پوټکی چې د وچېدو پر مهال تاوېږي.',
      '{"en":"Dried inner bark obtained from cinnamon trees. Bark is peeled from stems or branches and curls into quills as it dries.","ur":"دارچینی ثابت: دارچینی کے درخت کے تنوں یا شاخوں سے اتاری گئی اندرونی چھال جو سوکھنے پر نلی نما گھنگھریالی ہو جاتی ہے۔","ar":"قرفة أعواد (دارسين): اللحاء الداخلي المجفف المستخرج من أشجار القرفة، يُقشر ويلتف على شكل لفائف أسطوانية عند جفافه.","fa":"دارچین درسته (چوب دارچین): پوسته درونی خشک شده تنه یا شاخه‌های درخت دارچین که هنگام خشک شدن لوله می‌شود.","ps":"پوره دارچیني (ډکي): د دارچیني د ونې د ښاخونو وچ شوی داخلي پوټکی چې د وچېدو پر مهال تاوېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Cinnamon Powder
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Cinnamon Powder') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Powder produced by grinding dried cinnamon tree bark.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Powder produced by grinding dried cinnamon tree bark.',
      'en'::text,
      'Powder produced by grinding dried cinnamon tree bark.',
      'دارچینی پاؤڈر: دارچینی کے درخت کی خشک چھال کو پیس کر تیار کردہ خوشبودار سفوف۔',
      'قرفة مطحونة: مسحوق ناتج عن طحن لحاء شجرة القرفة المجفف.',
      'پودر دارچین: گرد خوشبو به دست آمده از آسیاب کردن چوب خشک دارچین.',
      'د دارچینۍ پوډر: د دارچیني د وچ شوي پوټکي له میده کولو جوړ شوی خوشبویه پوډر.',
      '{"en":"Powder produced by grinding dried cinnamon tree bark.","ur":"دارچینی پاؤڈر: دارچینی کے درخت کی خشک چھال کو پیس کر تیار کردہ خوشبودار سفوف۔","ar":"قرفة مطحونة: مسحوق ناتج عن طحن لحاء شجرة القرفة المجفف.","fa":"پودر دارچین: گرد خوشبو به دست آمده از آسیاب کردن چوب خشک دارچین.","ps":"د دارچینۍ پوډر: د دارچیني د وچ شوي پوټکي له میده کولو جوړ شوی خوشبویه پوډر."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Cloves Whole
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Cloves Whole') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Unopened flower buds of the clove tree. The buds are picked before the flowers open and dried until they become dark brown.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Unopened flower buds of the clove tree. The buds are picked before the flowers open and dried until they become dark brown.',
      'en'::text,
      'Unopened flower buds of the clove tree. The buds are picked before the flowers open and dried until they become dark brown.',
      'ثابت لونگ: لونگ کے درخت کی نا کھلی پھولوں کی کلیاں۔ انہیں پھول کھلنے سے پہلے توڑا جاتا ہے اور گہرا بھورا ہونے تک سکھایا جاتا ہے۔',
      'قرنفل كامل (مسمار): براعم زهرية غير متفتحة لشجرة القرنفل، تُقطف قبل تفتح الأزهار وتُجفف حتى تصبح بنية داكنة.',
      'میخک درسته: جوانه‌های بازنشده گل درخت میخک که پیش از شکوفا شدن چیده شده و تا قهوه‌ای تیره شدن خشک می‌شوند.',
      'لونګ پوره: د لونګ د ونې د ګلانو نه غوړېدلې غوټۍ چې تر غوړېدو مخکې راټولېږي او تر تورېدو پورې وچېږي.',
      '{"en":"Unopened flower buds of the clove tree. The buds are picked before the flowers open and dried until they become dark brown.","ur":"ثابت لونگ: لونگ کے درخت کی نا کھلی پھولوں کی کلیاں۔ انہیں پھول کھلنے سے پہلے توڑا جاتا ہے اور گہرا بھورا ہونے تک سکھایا جاتا ہے۔","ar":"قرنفل كامل (مسمار): براعم زهرية غير متفتحة لشجرة القرنفل، تُقطف قبل تفتح الأزهار وتُجفف حتى تصبح بنية داكنة.","fa":"میخک درسته: جوانه‌های بازنشده گل درخت میخک که پیش از شکوفا شدن چیده شده و تا قهوه‌ای تیره شدن خشک می‌شوند.","ps":"لونګ پوره: د لونګ د ونې د ګلانو نه غوړېدلې غوټۍ چې تر غوړېدو مخکې راټولېږي او تر تورېدو پورې وچېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Cloves Ground
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Cloves Ground') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Powder made by grinding dried flower buds of the clove tree.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Powder made by grinding dried flower buds of the clove tree.',
      'en'::text,
      'Powder made by grinding dried flower buds of the clove tree.',
      'پسی ہوئی لونگ: لونگ کے درخت کی خشک کلیوں کو پیس کر بنایا گیا خوشبودار سفوف۔',
      'قرنفل مطحون: مسحوق ناتج عن طحن براعم زهور القرنفل المجففة.',
      'پودر میخک: گرد معطر به دست آمده از آسیاب کردن غنچه‌های خشک میخک.',
      'میده شوي لونګ: پوډر چې د لونګ د ونې د وچو غوټیو له میده کولو جوړېږي.',
      '{"en":"Powder made by grinding dried flower buds of the clove tree.","ur":"پسی ہوئی لونگ: لونگ کے درخت کی خشک کلیوں کو پیس کر بنایا گیا خوشبودار سفوف۔","ar":"قرنفل مطحون: مسحوق ناتج عن طحن براعم زهور القرنفل المجففة.","fa":"پودر میخک: گرد معطر به دست آمده از آسیاب کردن غنچه‌های خشک میخک.","ps":"میده شوي لونګ: پوډر چې د لونګ د ونې د وچو غوټیو له میده کولو جوړېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Nutmeg Whole
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Nutmeg Whole') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The hard seed found inside the fruit of the nutmeg tree. The fruit splits when mature, exposing the seed and its surrounding mace.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The hard seed found inside the fruit of the nutmeg tree. The fruit splits when mature, exposing the seed and its surrounding mace.',
      'en'::text,
      'The hard seed found inside the fruit of the nutmeg tree. The fruit splits when mature, exposing the seed and its surrounding mace.',
      'ثابت جائفل: جائفل کے پھل کا سخت بیج۔ پھل پکنے پر خود پھٹ جاتا ہے جس سے بیج اور اس پر لپٹی جاوتری ظاہر ہو جاتی ہے۔',
      'جوزة الطيب كاملة: البذرة الصلبة الموجودة داخل ثمرة شجرة جوزة الطيب، وتنشق الثمرة عند النضج لتظهر البذرة وغلافها.',
      'جوز هندی درسته: دانه سخت موجود در داخل میوه درخت جوز هندی که پس از رسیدن میوه و شکافتن آن نمایان می‌شود.',
      'جایفل پوره: د جایفل د مېوې دننه سخت زړی چې د مېوې د پخېدو پر مهال د چاودېدو له امله ښکاره کېږي.',
      '{"en":"The hard seed found inside the fruit of the nutmeg tree. The fruit splits when mature, exposing the seed and its surrounding mace.","ur":"ثابت جائفل: جائفل کے پھل کا سخت بیج۔ پھل پکنے پر خود پھٹ جاتا ہے جس سے بیج اور اس پر لپٹی جاوتری ظاہر ہو جاتی ہے۔","ar":"جوزة الطيب كاملة: البذرة الصلبة الموجودة داخل ثمرة شجرة جوزة الطيب، وتنشق الثمرة عند النضج لتظهر البذرة وغلافها.","fa":"جوز هندی درسته: دانه سخت موجود در داخل میوه درخت جوز هندی که پس از رسیدن میوه و شکافتن آن نمایان می‌شود.","ps":"جایفل پوره: د جایفل د مېوې دننه سخت زړی چې د مېوې د پخېدو پر مهال د چاودېدو له امله ښکاره کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Nutmeg Ground
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Nutmeg Ground') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Powder produced by grinding the dried seed of the nutmeg fruit.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Powder produced by grinding the dried seed of the nutmeg fruit.',
      'en'::text,
      'Powder produced by grinding the dried seed of the nutmeg fruit.',
      'پسی ہوئی جائفل: جائفل کے خشک بیج کو باریک پیس کر تیار کیا گیا سفوف۔',
      'جوزة الطيب مطحونة: مسحوق ناتج عن طحن بذرة جوزة الطيب المجففة.',
      'پودر جوز هندی: گرد خوشبو و تند حاصل از آسیاب کردن مغز خشک جوز هندی.',
      'میده شوی جایفل: پوډر چې د جایفل د وچ شوي زړي له میده کولو څخه لاسته راځي.',
      '{"en":"Powder produced by grinding the dried seed of the nutmeg fruit.","ur":"پسی ہوئی جائفل: جائفل کے خشک بیج کو باریک پیس کر تیار کیا گیا سفوف۔","ar":"جوزة الطيب مطحونة: مسحوق ناتج عن طحن بذرة جوزة الطيب المجففة.","fa":"پودر جوز هندی: گرد خوشبو و تند حاصل از آسیاب کردن مغز خشک جوز هندی.","ps":"میده شوی جایفل: پوډر چې د جایفل د وچ شوي زړي له میده کولو څخه لاسته راځي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Mace Whole
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Mace Whole') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The red/orange lace-like aril that surrounds the nutmeg seed inside the fruit. It is removed and dried separately.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The red/orange lace-like aril that surrounds the nutmeg seed inside the fruit. It is removed and dried separately.',
      'en'::text,
      'The red/orange lace-like aril that surrounds the nutmeg seed inside the fruit. It is removed and dried separately.',
      'ثابت جاوتری: سرخ/نارنجی جالی دار چھال جو جائفل کے بیج کے گرد لپٹی ہوتی ہے۔ اسے الگ کر کے سکھایا جاتا ہے۔',
      'بسباسة كاملة (قشرة جوزة الطيب): الغلاف الشبكي ذو اللون الأحمر أو البرتقالي المحيط ببذرة جوزة الطيب، يُنزع ويُجفف بشكل مستقل.',
      'اطریفل / جوزبوا (ماکیس) درسته: پوسته مشبک و توری سرخ‌رنگی که دانه جوز هندی را فرا گرفته و جداگانه خشک می‌شود.',
      'جاوتري پوره: هغه سور رنګه جالۍ ډوله پوښ چې د جایفل د زړي پر شاوخوا تاو وي او جلا وچېږي.',
      '{"en":"The red/orange lace-like aril that surrounds the nutmeg seed inside the fruit. It is removed and dried separately.","ur":"ثابت جاوتری: سرخ/نارنجی جالی دار چھال جو جائفل کے بیج کے گرد لپٹی ہوتی ہے۔ اسے الگ کر کے سکھایا جاتا ہے۔","ar":"بسباسة كاملة (قشرة جوزة الطيب): الغلاف الشبكي ذو اللون الأحمر أو البرتقالي المحيط ببذرة جوزة الطيب، يُنزع ويُجفف بشكل مستقل.","fa":"اطریفل / جوزبوا (ماکیس) درسته: پوسته مشبک و توری سرخ‌رنگی که دانه جوز هندی را فرا گرفته و جداگانه خشک می‌شود.","ps":"جاوتري پوره: هغه سور رنګه جالۍ ډوله پوښ چې د جایفل د زړي پر شاوخوا تاو وي او جلا وچېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Mace Ground
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Mace Ground') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Powder made by grinding dried mace, the outer aril surrounding the nutmeg seed.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Powder made by grinding dried mace, the outer aril surrounding the nutmeg seed.',
      'en'::text,
      'Powder made by grinding dried mace, the outer aril surrounding the nutmeg seed.',
      'پسی ہوئی جاوتری: جائفل کے گرد موجود خشک جالی دار چھال (جاوتری) کو پیس کر تیار کردہ سفوف۔',
      'بسباسة مطحونة: مسحوق ناتج عن طحن قشور جوزة الطيب المجففة (البسباسة).',
      'پودر جاوتری (ماکیس): گرد حاصل از آسیاب کردن پوسته توری خشک شده دور جوز هندی.',
      'میده شوې جاوتري: پوډر چې د جایفل پر شاوخوا د وچې شوې جاوتري له میده کولو جوړېږي.',
      '{"en":"Powder made by grinding dried mace, the outer aril surrounding the nutmeg seed.","ur":"پسی ہوئی جاوتری: جائفل کے گرد موجود خشک جالی دار چھال (جاوتری) کو پیس کر تیار کردہ سفوف۔","ar":"بسباسة مطحونة: مسحوق ناتج عن طحن قشور جوزة الطيب المجففة (البسباسة).","fa":"پودر جاوتری (ماکیس): گرد حاصل از آسیاب کردن پوسته توری خشک شده دور جوز هندی.","ps":"میده شوې جاوتري: پوډر چې د جایفل پر شاوخوا د وچې شوې جاوتري له میده کولو جوړېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Cardamom Whole
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Cardamom Whole') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Seed pods produced on a perennial herbaceous cardamom plant. The green or dried pods contain numerous aromatic seeds.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Seed pods produced on a perennial herbaceous cardamom plant. The green or dried pods contain numerous aromatic seeds.',
      'en'::text,
      'Seed pods produced on a perennial herbaceous cardamom plant. The green or dried pods contain numerous aromatic seeds.',
      'ثابت الائچی: الائچی کے پودے کی پھلیاں جن کے اندر خوشبودار بیج بھرے ہوتے ہیں۔ یہ سبز یا خشک شکل میں استعمال ہوتی ہے۔',
      'هيل كامل (حبهان): قرون البذور لنبات الهيل العشبي المعمر، وتحتوي القرونة الخضراء أو المجففة على بذور عطرية مميزة.',
      'هل درسته (هل سبز): کپسول‌های دانه‌ای بوته هل که درون آن‌ها پر از دانه‌های معطر و خوشبو است.',
      'پوره هیل (شین الایچي): د هیل د بوټي پلي چې دننه بې شمېره خوشبویه زړي لري.',
      '{"en":"Seed pods produced on a perennial herbaceous cardamom plant. The green or dried pods contain numerous aromatic seeds.","ur":"ثابت الائچی: الائچی کے پودے کی پھلیاں جن کے اندر خوشبودار بیج بھرے ہوتے ہیں۔ یہ سبز یا خشک شکل میں استعمال ہوتی ہے۔","ar":"هيل كامل (حبهان): قرون البذور لنبات الهيل العشبي المعمر، وتحتوي القرونة الخضراء أو المجففة على بذور عطرية مميزة.","fa":"هل درسته (هل سبز): کپسول‌های دانه‌ای بوته هل که درون آن‌ها پر از دانه‌های معطر و خوشبو است.","ps":"پوره هیل (شین الایچي): د هیل د بوټي پلي چې دننه بې شمېره خوشبویه زړي لري."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Cardamom Ground
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Cardamom Ground') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Powder made from cardamom seeds or whole dried cardamom pods.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Powder made from cardamom seeds or whole dried cardamom pods.',
      'en'::text,
      'Powder made from cardamom seeds or whole dried cardamom pods.',
      'پسی ہوئی الائچی: الائچی کے بیجوں یا مکمل خشک پھلیوں کو پیس کر تیار کیا گیا معطر سفوف۔',
      'هيل مطحون: مسحوق ناتج عن طحن بذور الهيل أو قرونه الكاملة المجففة.',
      'پودر هل: گرد بسیار معطر تهیه شده از آسیاب دانه‌ها یا غلاف‌های کامل هل.',
      'میده شوی هیل: د هیل له زړو یا ټولو وچو پلو څخه جوړ شوی خوشبویه پوډر.',
      '{"en":"Powder made from cardamom seeds or whole dried cardamom pods.","ur":"پسی ہوئی الائچی: الائچی کے بیجوں یا مکمل خشک پھلیوں کو پیس کر تیار کیا گیا معطر سفوف۔","ar":"هيل مطحون: مسحوق ناتج عن طحن بذور الهيل أو قرونه الكاملة المجففة.","fa":"پودر هل: گرد بسیار معطر تهیه شده از آسیاب دانه‌ها یا غلاف‌های کامل هل.","ps":"میده شوی هیل: د هیل له زړو یا ټولو وچو پلو څخه جوړ شوی خوشبویه پوډر."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Coriander Seeds
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Coriander Seeds') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Mature dried seeds of the coriander herb. The same plant produces fresh coriander leaves before flowering and seed formation.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Mature dried seeds of the coriander herb. The same plant produces fresh coriander leaves before flowering and seed formation.',
      'en'::text,
      'Mature dried seeds of the coriander herb. The same plant produces fresh coriander leaves before flowering and seed formation.',
      'ثابت دھنیا: دھنیا کے پودے کے مکمل پکے ہوئے خشک بیج۔ یہی پودا پھول آنے اور بیج بننے سے پہلے تازہ ہرا دھنیا پیدا کرتا ہے۔',
      'كزبرة حب (بذور): البذور المجففة الناضجة لنبات الكزبرة، وهو النبات نفسه الذي ينتج أوراق الكزبرة الخضراء الطازجة.',
      'تخم گشنیز درسته: دانه‌های خشک و رسیده سبزی گشنیز که پیش از گل‌دهی برگ‌های تازه آن چیده می‌شود.',
      'د دانیا زړي: د دانیا د بوټي پخې او وچې شوې دانې چې تر ګل کولو مخکې شنه دانیا هم تولیدوي.',
      '{"en":"Mature dried seeds of the coriander herb. The same plant produces fresh coriander leaves before flowering and seed formation.","ur":"ثابت دھنیا: دھنیا کے پودے کے مکمل پکے ہوئے خشک بیج۔ یہی پودا پھول آنے اور بیج بننے سے پہلے تازہ ہرا دھنیا پیدا کرتا ہے۔","ar":"كزبرة حب (بذور): البذور المجففة الناضجة لنبات الكزبرة، وهو النبات نفسه الذي ينتج أوراق الكزبرة الخضراء الطازجة.","fa":"تخم گشنیز درسته: دانه‌های خشک و رسیده سبزی گشنیز که پیش از گل‌دهی برگ‌های تازه آن چیده می‌شود.","ps":"د دانیا زړي: د دانیا د بوټي پخې او وچې شوې دانې چې تر ګل کولو مخکې شنه دانیا هم تولیدوي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Coriander Powder
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Coriander Powder') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Powder obtained by grinding dried mature coriander seeds.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Powder obtained by grinding dried mature coriander seeds.',
      'en'::text,
      'Powder obtained by grinding dried mature coriander seeds.',
      'پسا ہوا دھنیا: دھنیا کے خشک پکے ہوئے بیجوں کو پیس کر حاصل کیا گیا خوشبودار سفوف۔',
      'كزبرة مطحونة: مسحوق يُستحصل عليه بطحن بذور الكزبرة الجافة الناضجة.',
      'پودر گشنیز: گرد خوشبو به دست آمده از آسیاب دانه‌های خشک گشنیز.',
      'میده شوې دانیا: پوډر چې د دانیا د پخو وچو زړو له میده کولو څخه جوړېږي.',
      '{"en":"Powder obtained by grinding dried mature coriander seeds.","ur":"پسا ہوا دھنیا: دھنیا کے خشک پکے ہوئے بیجوں کو پیس کر حاصل کیا گیا خوشبودار سفوف۔","ar":"كزبرة مطحونة: مسحوق يُستحصل عليه بطحن بذور الكزبرة الجافة الناضجة.","fa":"پودر گشنیز: گرد خوشبو به دست آمده از آسیاب دانه‌های خشک گشنیز.","ps":"میده شوې دانیا: پوډر چې د دانیا د پخو وچو زړو له میده کولو څخه جوړېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Cumin Seeds
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Cumin Seeds') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Dried elongated seeds of the cumin herb. The plant produces small flowers followed by aromatic seed-like fruits.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Dried elongated seeds of the cumin herb. The plant produces small flowers followed by aromatic seed-like fruits.',
      'en'::text,
      'Dried elongated seeds of the cumin herb. The plant produces small flowers followed by aromatic seed-like fruits.',
      'ثابت زیرہ: زیرے کے پودے کے لمبوترے خشک بیج۔ پودے پر چھوٹے پھول آتے ہیں جن کے بعد خوشبودار بیج بنتے ہیں۔',
      'كمون حب: بذور نبات الكمون المستطيلة المجففة، وتنتج النبتة أزهارًا صغيرة تعقبها ثمار عطرية شبيهة بالبذور.',
      'زیره درسته (زیره سبز/سیاه): دانه‌های باریک و خشک بوته زیره که پس از گل‌دهی بوته تشکیل می‌شوند.',
      'پوره زېره: د زېرې د بوټي اوږدې وچې شوې دانې چې د کوچنیو ګلانو له غوړېدو وروسته جوړېږي.',
      '{"en":"Dried elongated seeds of the cumin herb. The plant produces small flowers followed by aromatic seed-like fruits.","ur":"ثابت زیرہ: زیرے کے پودے کے لمبوترے خشک بیج۔ پودے پر چھوٹے پھول آتے ہیں جن کے بعد خوشبودار بیج بنتے ہیں۔","ar":"كمون حب: بذور نبات الكمون المستطيلة المجففة، وتنتج النبتة أزهارًا صغيرة تعقبها ثمار عطرية شبيهة بالبذور.","fa":"زیره درسته (زیره سبز/سیاه): دانه‌های باریک و خشک بوته زیره که پس از گل‌دهی بوته تشکیل می‌شوند.","ps":"پوره زېره: د زېرې د بوټي اوږدې وچې شوې دانې چې د کوچنیو ګلانو له غوړېدو وروسته جوړېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Cumin Powder
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Cumin Powder') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Powder made from ground dried cumin seeds.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Powder made from ground dried cumin seeds.',
      'en'::text,
      'Powder made from ground dried cumin seeds.',
      'پسا ہوا زیرہ: زیرے کے خشک بیجوں کو پیس کر تیار کردہ ذائقے دار سفوف۔',
      'كمون مطحون: مسحوق ناتج عن طحن بذور الكمون المجففة.',
      'پودر زیره: گرد معطر به دست آمده از آسیاب کردن دانه‌های خشک زیره.',
      'میده شوې زېره: د زېرې له وچو زړو څخه جوړ شوی پوډر.',
      '{"en":"Powder made from ground dried cumin seeds.","ur":"پسا ہوا زیرہ: زیرے کے خشک بیجوں کو پیس کر تیار کردہ ذائقے دار سفوف۔","ar":"كمون مطحون: مسحوق ناتج عن طحن بذور الكمون المجففة.","fa":"پودر زیره: گرد معطر به دست آمده از آسیاب کردن دانه‌های خشک زیره.","ps":"میده شوې زېره: د زېرې له وچو زړو څخه جوړ شوی پوډر."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Fennel Seeds
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Fennel Seeds') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Aromatic dried seeds/fruits produced by the fennel herb after its yellow flower clusters mature.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Aromatic dried seeds/fruits produced by the fennel herb after its yellow flower clusters mature.',
      'en'::text,
      'Aromatic dried seeds/fruits produced by the fennel herb after its yellow flower clusters mature.',
      'ثابت سونف: سونف کے پودے کے خوشبودار خشک بیج جو زرد پھولوں کے گچھے پکنے کے بعد بنتے ہیں۔',
      'شمر حب (شمار / حبة حلوة): بذور عطرية مجففة تُنتجها نبتة الشمر بعد نضج أزهارها الصفراء.',
      'رازیانه درسته: دانه‌های معطر و خشک بوته رازیانه که پس از رسیدن چترهای گل زرد شکل می‌گیرند.',
      'بادیان (سونف) پوره: د بادیان د بوټي خوشبویه وچې دانې چې د ژېړو ګلانو تر پخېدو وروسته رامنځته کېږي.',
      '{"en":"Aromatic dried seeds/fruits produced by the fennel herb after its yellow flower clusters mature.","ur":"ثابت سونف: سونف کے پودے کے خوشبودار خشک بیج جو زرد پھولوں کے گچھے پکنے کے بعد بنتے ہیں۔","ar":"شمر حب (شمار / حبة حلوة): بذور عطرية مجففة تُنتجها نبتة الشمر بعد نضج أزهارها الصفراء.","fa":"رازیانه درسته: دانه‌های معطر و خشک بوته رازیانه که پس از رسیدن چترهای گل زرد شکل می‌گیرند.","ps":"بادیان (سونف) پوره: د بادیان د بوټي خوشبویه وچې دانې چې د ژېړو ګلانو تر پخېدو وروسته رامنځته کېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Fennel Powder
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Fennel Powder') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Powder obtained by grinding dried fennel seeds.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Powder obtained by grinding dried fennel seeds.',
      'en'::text,
      'Powder obtained by grinding dried fennel seeds.',
      'پسی ہوئی سونف: خشک سونف کے بیجوں کو پیس کر تیار کیا گیا خوشبودار سفوف۔',
      'شمر مطحون: مسحوق ناتج عن طحن بذور الشمر المجففة.',
      'پودر رازیانه: گرد معطر حاصل از آسیاب کردن دانه‌های خشک رازیانه.',
      'میده شوي بادیان: پوډر چې د بادیان د وچو دانو له میده کولو لاسته راځي.',
      '{"en":"Powder obtained by grinding dried fennel seeds.","ur":"پسی ہوئی سونف: خشک سونف کے بیجوں کو پیس کر تیار کیا گیا خوشبودار سفوف۔","ar":"شمر مطحون: مسحوق ناتج عن طحن بذور الشمر المجففة.","fa":"پودر رازیانه: گرد معطر حاصل از آسیاب کردن دانه‌های خشک رازیانه.","ps":"میده شوي بادیان: پوډر چې د بادیان د وچو دانو له میده کولو لاسته راځي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Anise Seeds
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Anise Seeds') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Aromatic seeds/fruits produced by the anise herb. The small seeds form after the plant''s flowers mature.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Aromatic seeds/fruits produced by the anise herb. The small seeds form after the plant''s flowers mature.',
      'en'::text,
      'Aromatic seeds/fruits produced by the anise herb. The small seeds form after the plant''s flowers mature.',
      'ثابت انیسون: انیسون کے پودے کے خوشبودار بیج جو پودے کے پھول پکنے کے بعد حاصل ہوتے ہیں۔',
      'يانسون حب: بذور عطرية تُنتجها نبتة اليانسون وتتشكل البذور الصغيرة بعد نضج الأزهار.',
      'انیسون درسته (بادیان رومی): دانه‌های ریز و معطر گیاه انیسون که پس از رسیدن گل‌ها پدید می‌آیند.',
      'انیسون پوره: د انیسون د بوټي خوشبویه زړي چې د ګلانو له پخېدو وروسته جوړېږي.',
      '{"en":"Aromatic seeds/fruits produced by the anise herb. The small seeds form after the plant''s flowers mature.","ur":"ثابت انیسون: انیسون کے پودے کے خوشبودار بیج جو پودے کے پھول پکنے کے بعد حاصل ہوتے ہیں۔","ar":"يانسون حب: بذور عطرية تُنتجها نبتة اليانسون وتتشكل البذور الصغيرة بعد نضج الأزهار.","fa":"انیسون درسته (بادیان رومی): دانه‌های ریز و معطر گیاه انیسون که پس از رسیدن گل‌ها پدید می‌آیند.","ps":"انیسون پوره: د انیسون د بوټي خوشبویه زړي چې د ګلانو له پخېدو وروسته جوړېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Anise Powder
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Anise Powder') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Ground powder produced from dried anise seeds.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Ground powder produced from dried anise seeds.',
      'en'::text,
      'Ground powder produced from dried anise seeds.',
      'پسا ہوا انیسون: خشک انیسون کے بیجوں کو پیس کر تیار کیا گیا سفوف۔',
      'يانسون مطحون: مسحوق ناعم يُنتج بطحن بذور اليانسون المجففة.',
      'پودر انیسون: گرد نرم معطر حاصل از آسیاب کردن دانه‌های انیسون.',
      'میده شوی انیسون: د انیسون له وچو زړو جوړ شوی نرم پوډر.',
      '{"en":"Ground powder produced from dried anise seeds.","ur":"پسا ہوا انیسون: خشک انیسون کے بیجوں کو پیس کر تیار کیا گیا سفوف۔","ar":"يانسون مطحون: مسحوق ناعم يُنتج بطحن بذور اليانسون المجففة.","fa":"پودر انیسون: گرد نرم معطر حاصل از آسیاب کردن دانه‌های انیسون.","ps":"میده شوی انیسون: د انیسون له وچو زړو جوړ شوی نرم پوډر."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Star Anise
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Star Anise') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Star-shaped dried fruit produced by an evergreen tree. Each woody point of the star normally contains a seed.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Star-shaped dried fruit produced by an evergreen tree. Each woody point of the star normally contains a seed.',
      'en'::text,
      'Star-shaped dried fruit produced by an evergreen tree. Each woody point of the star normally contains a seed.',
      'بادیان خطائی (سٹار اینیس): سدا بہار درخت کا ستارہ نما خشک پھل جس کے ہر کونے میں ایک بیج ہوتا ہے۔',
      'يانسون نجمي: ثمرة جافة نجمية الشكل تُنتجها شجرة دائمة الخضرة، وتحتوي كل زاوية خشبية على بذرة.',
      'بادیان ختایی (انیسون ستاره‌ای): میوه خشک ستاره‌ای‌شکل درخت همیشه‌سبز که هر پره چوبی آن حاوی یک دانه است.',
      'ستوری بادیان: د تل شنه ونې ستوريزه وچه مېوه چې په هر لرګین سر کې یې یو زړی وي.',
      '{"en":"Star-shaped dried fruit produced by an evergreen tree. Each woody point of the star normally contains a seed.","ur":"بادیان خطائی (سٹار اینیس): سدا بہار درخت کا ستارہ نما خشک پھل جس کے ہر کونے میں ایک بیج ہوتا ہے۔","ar":"يانسون نجمي: ثمرة جافة نجمية الشكل تُنتجها شجرة دائمة الخضرة، وتحتوي كل زاوية خشبية على بذرة.","fa":"بادیان ختایی (انیسون ستاره‌ای): میوه خشک ستاره‌ای‌شکل درخت همیشه‌سبز که هر پره چوبی آن حاوی یک دانه است.","ps":"ستوری بادیان: د تل شنه ونې ستوريزه وچه مېوه چې په هر لرګین سر کې یې یو زړی وي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Star Anise Powder
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Star Anise Powder') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Powder obtained by grinding dried star-shaped fruits of the star anise tree.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Powder obtained by grinding dried star-shaped fruits of the star anise tree.',
      'en'::text,
      'Powder obtained by grinding dried star-shaped fruits of the star anise tree.',
      'بادیان خطائی پاؤڈر: بادیان خطائی کے ستارہ نما خشک پھلوں کو پیس کر تیار کردہ خوشبودار سفوف۔',
      'يانسون نجمي مطحون: مسحوق يُستحصل عليه بطحن ثمار اليانسون النجمي المجففة.',
      'پودر بادیان ختایی: گرد معطر حاصل از آسیاب کردن میوه‌های ستاره‌ای بادیان ختایی.',
      'د ستوري بادیان پوډر: د ستوري بادیان له وچې مېوې څخه جوړ شوی خوشبویه پوډر.',
      '{"en":"Powder obtained by grinding dried star-shaped fruits of the star anise tree.","ur":"بادیان خطائی پاؤڈر: بادیان خطائی کے ستارہ نما خشک پھلوں کو پیس کر تیار کردہ خوشبودار سفوف۔","ar":"يانسون نجمي مطحون: مسحوق يُستحصل عليه بطحن ثمار اليانسون النجمي المجففة.","fa":"پودر بادیان ختایی: گرد معطر حاصل از آسیاب کردن میوه‌های ستاره‌ای بادیان ختایی.","ps":"د ستوري بادیان پوډر: د ستوري بادیان له وچې مېوې څخه جوړ شوی خوشبویه پوډر."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Caraway Seeds
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Caraway Seeds') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Aromatic dried fruits/seeds produced by the caraway herb after flowering.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Aromatic dried fruits/seeds produced by the caraway herb after flowering.',
      'en'::text,
      'Aromatic dried fruits/seeds produced by the caraway herb after flowering.',
      'شاہ زیرہ / کاراوے سیڈز: پودے کے پھول آنے کے بعد پیدا ہونے والے خوشبودار خشک بیج۔',
      'كروياء حب: ثمار أو بذور عطرية مجففة تُنتجها نبتة الكروياء بعد مرحلة الإزهار.',
      'کَرَویه (شاه‌زیره) درسته: دانه‌های معطر و خشک بوته کرویه که پس از گل‌دهی تولید می‌شوند.',
      'شاه زېره (کاراوې) پوره: د بوټي خوشبویه وچې دانې چې تر ګل کولو وروسته لاسته راځي.',
      '{"en":"Aromatic dried fruits/seeds produced by the caraway herb after flowering.","ur":"شاہ زیرہ / کاراوے سیڈز: پودے کے پھول آنے کے بعد پیدا ہونے والے خوشبودار خشک بیج۔","ar":"كروياء حب: ثمار أو بذور عطرية مجففة تُنتجها نبتة الكروياء بعد مرحلة الإزهار.","fa":"کَرَویه (شاه‌زیره) درسته: دانه‌های معطر و خشک بوته کرویه که پس از گل‌دهی تولید می‌شوند.","ps":"شاه زېره (کاراوې) پوره: د بوټي خوشبویه وچې دانې چې تر ګل کولو وروسته لاسته راځي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Caraway Powder
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Caraway Powder') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Powder obtained by grinding dried caraway seeds.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Powder obtained by grinding dried caraway seeds.',
      'en'::text,
      'Powder obtained by grinding dried caraway seeds.',
      'پسی ہوئی شاہ زیرہ: خشک شاہ زیرہ کے بیجوں کو پیس کر تیار کیا گیا سفوف۔',
      'كروياء مطحونة: مسحوق ناتج عن طحن بذور الكروياء المجففة.',
      'پودر کرویه: گرد معطر حاصل از آسیاب دانه‌های خشک شاه‌زیره.',
      'میده شوې شاه زېره: د شاه زېرې د وچو زړو له میده کولو څخه لاسته راغلی پوډر.',
      '{"en":"Powder obtained by grinding dried caraway seeds.","ur":"پسی ہوئی شاہ زیرہ: خشک شاہ زیرہ کے بیجوں کو پیس کر تیار کیا گیا سفوف۔","ar":"كروياء مطحونة: مسحوق ناتج عن طحن بذور الكروياء المجففة.","fa":"پودر کرویه: گرد معطر حاصل از آسیاب دانه‌های خشک شاه‌زیره.","ps":"میده شوې شاه زېره: د شاه زېرې د وچو زړو له میده کولو څخه لاسته راغلی پوډر."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Juniper Berries
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Juniper Berries') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Berry-like seed cones produced by juniper shrubs or small trees. They mature on the branches and are dried for spice use.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Berry-like seed cones produced by juniper shrubs or small trees. They mature on the branches and are dried for spice use.',
      'en'::text,
      'Berry-like seed cones produced by juniper shrubs or small trees. They mature on the branches and are dried for spice use.',
      'جونیپر بیریز: صنوبر جھاڑیوں کے بیری نما مخروطی دانے جو شاخوں پر پکتے ہیں اور بطور مصالحہ سکھائے جاتے ہیں۔',
      'ثمار العرعر: مخاريط بذرية شبيهة بالتوت تُنتجها شجيرات العرعر، وتنضج على الأغصان وتُجفف كبهارات.',
      'میوه ارس (جونیپر): مخروط‌های توت‌مانند درختچه سرو کوهی (ارس) که برای ادویه خشک می‌شوند.',
      'د لمنځې مېوه (جونیپر بیري): د ارس بوټو د دانو غوندې مېوه چې پر ښاخونو پخېږي او د مسالې لپاره وچېږي.',
      '{"en":"Berry-like seed cones produced by juniper shrubs or small trees. They mature on the branches and are dried for spice use.","ur":"جونیپر بیریز: صنوبر جھاڑیوں کے بیری نما مخروطی دانے جو شاخوں پر پکتے ہیں اور بطور مصالحہ سکھائے جاتے ہیں۔","ar":"ثمار العرعر: مخاريط بذرية شبيهة بالتوت تُنتجها شجيرات العرعر، وتنضج على الأغصان وتُجفف كبهارات.","fa":"میوه ارس (جونیپر): مخروط‌های توت‌مانند درختچه سرو کوهی (ارس) که برای ادویه خشک می‌شوند.","ps":"د لمنځې مېوه (جونیپر بیري): د ارس بوټو د دانو غوندې مېوه چې پر ښاخونو پخېږي او د مسالې لپاره وچېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Ginger Whole / Dry
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Ginger Whole / Dry') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The dried underground rhizome of the ginger plant. The usable aromatic part grows horizontally below the soil and is dug up after maturity.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The dried underground rhizome of the ginger plant. The usable aromatic part grows horizontally below the soil and is dug up after maturity.',
      'en'::text,
      'The dried underground rhizome of the ginger plant. The usable aromatic part grows horizontally below the soil and is dug up after maturity.',
      'سونٹھ (خشک ادرک): ادرک کے پودے کی زیرِ زمین جڑ (رائیزوم) جو زمین میں افقی اگتی ہے اور پکنے پر کھود کر سکھائی جاتی ہے۔',
      'زنجبيل جاف كامل: الجذمور المجفف لنبات الزنجبيل النامي تحت الأرض، وينمو أفقيًا تحت التربة ويُستخرج بعد النضج.',
      'زنجبیل خشک درسته: ریزوم زیرزمینی و معطر گیاه زنجبیل که به صورت افقی رشد کرده و پس از برداشت خشک می‌شود.',
      'وچ زنجبیل پوره: د زنجبیل د بوټي تر ځمکې لاندې خوشبویه ریښه چې تر پخېدو وروسته کیندل او وچېږي.',
      '{"en":"The dried underground rhizome of the ginger plant. The usable aromatic part grows horizontally below the soil and is dug up after maturity.","ur":"سونٹھ (خشک ادرک): ادرک کے پودے کی زیرِ زمین جڑ (رائیزوم) جو زمین میں افقی اگتی ہے اور پکنے پر کھود کر سکھائی جاتی ہے۔","ar":"زنجبيل جاف كامل: الجذمور المجفف لنبات الزنجبيل النامي تحت الأرض، وينمو أفقيًا تحت التربة ويُستخرج بعد النضج.","fa":"زنجبیل خشک درسته: ریزوم زیرزمینی و معطر گیاه زنجبیل که به صورت افقی رشد کرده و پس از برداشت خشک می‌شود.","ps":"وچ زنجبیل پوره: د زنجبیل د بوټي تر ځمکې لاندې خوشبویه ریښه چې تر پخېدو وروسته کیندل او وچېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Ginger Powder
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Ginger Powder') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Powder made by drying and grinding the underground ginger rhizome.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Powder made by drying and grinding the underground ginger rhizome.',
      'en'::text,
      'Powder made by drying and grinding the underground ginger rhizome.',
      'سونٹھ پاؤڈر (پسی ادرک): زیرِ زمین اگنے والی خشک ادرک کی جڑ کو پیس کر تیار کردہ تیکھا سفوف۔',
      'زنجبيل مطحون: مسحوق مصنوع من تجفيف وطحن جذامير الزنجبيل النامية تحت الأرض.',
      'پودر زنجبیل: گرد تند و معطر حاصل از خشک کردن و آسیاب کردن ریزوم زنجبیل.',
      'د زنجبیل پوډر: میده شوی زنجبیل چې د ځمکې لاندې ریښې له وچولو او میده کولو جوړېږي.',
      '{"en":"Powder made by drying and grinding the underground ginger rhizome.","ur":"سونٹھ پاؤڈر (پسی ادرک): زیرِ زمین اگنے والی خشک ادرک کی جڑ کو پیس کر تیار کردہ تیکھا سفوف۔","ar":"زنجبيل مطحون: مسحوق مصنوع من تجفيف وطحن جذامير الزنجبيل النامية تحت الأرض.","fa":"پودر زنجبیل: گرد تند و معطر حاصل از خشک کردن و آسیاب کردن ریزوم زنجبیل.","ps":"د زنجبیل پوډر: میده شوی زنجبیل چې د ځمکې لاندې ریښې له وچولو او میده کولو جوړېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Saffron
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Saffron') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The dried red stigmas from flowers of the saffron crocus plant. Each flower produces only a few stigmas, which are hand collected and dried.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The dried red stigmas from flowers of the saffron crocus plant. Each flower produces only a few stigmas, which are hand collected and dried.',
      'en'::text,
      'The dried red stigmas from flowers of the saffron crocus plant. Each flower produces only a few stigmas, which are hand collected and dried.',
      'زعفران: زعفران کے پھولوں سے حاصل کردہ سرخ ریشے۔ ہر پھول سے صرف چند ریشے حاصل ہوتے ہیں جنہیں ہاتھ سے چن کر سکھایا جاتا ہے۔',
      'زعفران: المياسم الحمراء المجففة لزهور نبات زعفران الخريف، وتُجمع يدويًا من كل زهرة وتُجفف بعناية فائقة.',
      'زعفران: کلاله‌های سرخ‌رنگ خشک شده گل گیاه زعفران که با دست چیده و با دقت بسیار خشک می‌شود.',
      'زعفران: د زعفرانو د ګلانو سره وچ شوي تارونه چې په لاس راټول او په احتیاط وچېږي.',
      '{"en":"The dried red stigmas from flowers of the saffron crocus plant. Each flower produces only a few stigmas, which are hand collected and dried.","ur":"زعفران: زعفران کے پھولوں سے حاصل کردہ سرخ ریشے۔ ہر پھول سے صرف چند ریشے حاصل ہوتے ہیں جنہیں ہاتھ سے چن کر سکھایا جاتا ہے۔","ar":"زعفران: المياسم الحمراء المجففة لزهور نبات زعفران الخريف، وتُجمع يدويًا من كل زهرة وتُجفف بعناية فائقة.","fa":"زعفران: کلاله‌های سرخ‌رنگ خشک شده گل گیاه زعفران که با دست چیده و با دقت بسیار خشک می‌شود.","ps":"زعفران: د زعفرانو د ګلانو سره وچ شوي تارونه چې په لاس راټول او په احتیاط وچېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Turmeric Whole
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Turmeric Whole') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'The dried underground rhizome of the turmeric plant. The rhizome grows beneath the soil and develops its characteristic yellow/orange color.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'The dried underground rhizome of the turmeric plant. The rhizome grows beneath the soil and develops its characteristic yellow/orange color.',
      'en'::text,
      'The dried underground rhizome of the turmeric plant. The rhizome grows beneath the soil and develops its characteristic yellow/orange color.',
      'ثابت ہلدی: ہلدی کے پودے کی زیرِ زمین جڑ۔ یہ جڑ مٹی کے نیچے پروان چڑھتی ہے اور مخصوص گہرا زرد/نارنجی رنگ حاصل کرتی ہے۔',
      'كركم كامل (جذور): الجذامير المجففة لنبات الكركم النامية تحت التربة وتكتسب لونها الأصفر والبرتقالي المميز.',
      'زردچوبه درسته (ریشه زردچوبه): ریزوم زیرزمینی بوته زردچوبه که زیر خاک رشد کرده و رنگ زرد و نارنجی خاصی دارد.',
      'پوره کورکمن (هلدۍ): د کورکمن تر ځمکې لاندې ریښه چې تر خاورې لاندې خپل ځانګړی ژېړ رنګ اخلي.',
      '{"en":"The dried underground rhizome of the turmeric plant. The rhizome grows beneath the soil and develops its characteristic yellow/orange color.","ur":"ثابت ہلدی: ہلدی کے پودے کی زیرِ زمین جڑ۔ یہ جڑ مٹی کے نیچے پروان چڑھتی ہے اور مخصوص گہرا زرد/نارنجی رنگ حاصل کرتی ہے۔","ar":"كركم كامل (جذور): الجذامير المجففة لنبات الكركم النامية تحت التربة وتكتسب لونها الأصفر والبرتقالي المميز.","fa":"زردچوبه درسته (ریشه زردچوبه): ریزوم زیرزمینی بوته زردچوبه که زیر خاک رشد کرده و رنگ زرد و نارنجی خاصی دارد.","ps":"پوره کورکمن (هلدۍ): د کورکمن تر ځمکې لاندې ریښه چې تر خاورې لاندې خپل ځانګړی ژېړ رنګ اخلي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Turmeric Powder
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Turmeric Powder') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Powder made by drying and grinding turmeric rhizomes harvested from beneath the soil.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Powder made by drying and grinding turmeric rhizomes harvested from beneath the soil.',
      'en'::text,
      'Powder made by drying and grinding turmeric rhizomes harvested from beneath the soil.',
      'ہلدی پاؤڈر: زمین کے نیچے سے نکالی گئی ہلدی کی خشک جڑوں کو باریک پیس کر تیار کردہ زرد سفوف۔',
      'كركم مطحون: مسحوق ناتج عن تجفيف وطحن جذامير الكركم المحصودة من تحت التربة.',
      'پودر زردچوبه: گرد طلایی حاصل از خشک کردن و آسیاب ریشه‌های زردچوبه.',
      'د کورکمن پوډر: ژېړ پوډر چې د کورکمن د وچو ریښو له میده کولو څخه لاسته راځي.',
      '{"en":"Powder made by drying and grinding turmeric rhizomes harvested from beneath the soil.","ur":"ہلدی پاؤڈر: زمین کے نیچے سے نکالی گئی ہلدی کی خشک جڑوں کو باریک پیس کر تیار کردہ زرد سفوف۔","ar":"كركم مطحون: مسحوق ناتج عن تجفيف وطحن جذامير الكركم المحصودة من تحت التربة.","fa":"پودر زردچوبه: گرد طلایی حاصل از خشک کردن و آسیاب ریشه‌های زردچوبه.","ps":"د کورکمن پوډر: ژېړ پوډر چې د کورکمن د وچو ریښو له میده کولو څخه لاسته راځي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Thyme
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Thyme') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Aromatic leaves and tender stems of the thyme herb or small shrub. The above-ground parts are harvested and dried.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Aromatic leaves and tender stems of the thyme herb or small shrub. The above-ground parts are harvested and dried.',
      'en'::text,
      'Aromatic leaves and tender stems of the thyme herb or small shrub. The above-ground parts are harvested and dried.',
      'تھائم (زعتر): تھائم کے پودے کے خوشبودار پتے اور نرم ڈنڈیاں۔ زمین سے اوپر کے حصوں کو توڑ کر سکھایا جاتا ہے۔',
      'زعتر (صعتر): أوراق وسيقان عطرية لشجيرة الزعتر الصغيرة، تُحصد الأجزاء الهوائية وتُجفف بعناية.',
      'آویشن: برگ‌ها و ساقه‌های معطر و نازک بوته آویشن که پس از برداشت هوایی خشک می‌شوند.',
      'اویشن (زعتر): د بوټي خوشبویه پاڼې او نازکې ډنډرۍ چې له ټولولو وروسته وچېږي.',
      '{"en":"Aromatic leaves and tender stems of the thyme herb or small shrub. The above-ground parts are harvested and dried.","ur":"تھائم (زعتر): تھائم کے پودے کے خوشبودار پتے اور نرم ڈنڈیاں۔ زمین سے اوپر کے حصوں کو توڑ کر سکھایا جاتا ہے۔","ar":"زعتر (صعتر): أوراق وسيقان عطرية لشجيرة الزعتر الصغيرة، تُحصد الأجزاء الهوائية وتُجفف بعناية.","fa":"آویشن: برگ‌ها و ساقه‌های معطر و نازک بوته آویشن که پس از برداشت هوایی خشک می‌شوند.","ps":"اویشن (زعتر): د بوټي خوشبویه پاڼې او نازکې ډنډرۍ چې له ټولولو وروسته وچېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Bay Leaves
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Bay Leaves') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Aromatic leaves harvested from the bay laurel tree. Mature leaves are picked from the branches and dried before use.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Aromatic leaves harvested from the bay laurel tree. Mature leaves are picked from the branches and dried before use.',
      'en'::text,
      'Aromatic leaves harvested from the bay laurel tree. Mature leaves are picked from the branches and dried before use.',
      'تیز پات (تے پتا): لاریل کے درخت کے خوشبودار پتے۔ شاخوں سے پکے ہوئے پتے توڑ کر استعمال سے پہلے خشک کیے جاتے ہیں۔',
      'ورق غار (ورق لورا): أوراق عطرية تُحصد من شجرة الغار، وتُقطف الأوراق الناضجة من الأغصان وتُجفف قبل الاستخدام.',
      'برگ بو: برگ‌های معطر چیده شده از درخت لورل (برگ بو) که پیش از مصرف خشک می‌شوند.',
      'تیزپات (د غار پاڼې): د ونې خوشبویه پاڼې چې له ښاخونو راټولېږي او تر کارولو مخکې وچېږي.',
      '{"en":"Aromatic leaves harvested from the bay laurel tree. Mature leaves are picked from the branches and dried before use.","ur":"تیز پات (تے پتا): لاریل کے درخت کے خوشبودار پتے۔ شاخوں سے پکے ہوئے پتے توڑ کر استعمال سے پہلے خشک کیے جاتے ہیں۔","ar":"ورق غار (ورق لورا): أوراق عطرية تُحصد من شجرة الغار، وتُقطف الأوراق الناضجة من الأغصان وتُجفف قبل الاستخدام.","fa":"برگ بو: برگ‌های معطر چیده شده از درخت لورل (برگ بو) که پیش از مصرف خشک می‌شوند.","ps":"تیزپات (د غار پاڼې): د ونې خوشبویه پاڼې چې له ښاخونو راټولېږي او تر کارولو مخکې وچېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Curry Spice Mix
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Curry Spice Mix') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'A prepared mixture of several dried spices such as turmeric, coriander, cumin, chilli, fenugreek and other spices. It does not come from one single plant.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'A prepared mixture of several dried spices such as turmeric, coriander, cumin, chilli, fenugreek and other spices. It does not come from one single plant.',
      'en'::text,
      'A prepared mixture of several dried spices such as turmeric, coriander, cumin, chilli, fenugreek and other spices. It does not come from one single plant.',
      'کری اسپائس مکس: مختلف خشک مصالحہ جات جیسے ہلدی، دھنیا، زیرہ، مرچ اور میتھی کا تیار شدہ آمیزہ جو کسی ایک پودے سے حاصل نہیں ہوتا۔',
      'بهارات الكاري المشكلة: مزيج مُعد من عدة بهارات مجففة مثل الكركم والكزبرة والكمون والشطة والحلبة وغيرها، ولا ينتج من نبات واحد.',
      'پودر ادویه کاری: مخلوط فرآوری شده از چندین ادویه خشک نظیر زردچوبه، گشنیز، زیره، فلفل و شنبلیله.',
      'د کړي مسالې ترکیب: د څو وچو مسالو ګډ ترکیب لکه کورکمن، دانیا، زېره، مرچ او میتي چې له یو بوټي نه جوړېږي.',
      '{"en":"A prepared mixture of several dried spices such as turmeric, coriander, cumin, chilli, fenugreek and other spices. It does not come from one single plant.","ur":"کری اسپائس مکس: مختلف خشک مصالحہ جات جیسے ہلدی، دھنیا، زیرہ، مرچ اور میتھی کا تیار شدہ آمیزہ جو کسی ایک پودے سے حاصل نہیں ہوتا۔","ar":"بهارات الكاري المشكلة: مزيج مُعد من عدة بهارات مجففة مثل الكركم والكزبرة والكمون والشطة والحلبة وغيرها، ولا ينتج من نبات واحد.","fa":"پودر ادویه کاری: مخلوط فرآوری شده از چندین ادویه خشک نظیر زردچوبه، گشنیز، زیره، فلفل و شنبلیله.","ps":"د کړي مسالې ترکیب: د څو وچو مسالو ګډ ترکیب لکه کورکمن، دانیا، زېره، مرچ او میتي چې له یو بوټي نه جوړېږي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Garam Masala Mix
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Garam Masala Mix') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'A blended spice product made from several whole or ground spices, commonly including cumin, coriander, black pepper, cardamom, cinnamon, cloves and similar aromatic spices.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'A blended spice product made from several whole or ground spices, commonly including cumin, coriander, black pepper, cardamom, cinnamon, cloves and similar aromatic spices.',
      'en'::text,
      'A blended spice product made from several whole or ground spices, commonly including cumin, coriander, black pepper, cardamom, cinnamon, cloves and similar aromatic spices.',
      'گرم مصالحہ مکس: مختلف ثابت یا پسے ہوئے مصالحوں کا آمیزہ جس میں عام طور پر زیرہ، دھنیا، کالی مرچ، الائچی، دارچینی، لونگ اور دیگر معطر مصالحے شامل ہوتے ہیں۔',
      'خلطة غرام ماسالا: منتج بهارات ممزوج ومُعد من توابل كاملة أو مطحونة، يشمل عادة الكمون والكزبرة والفلفل الأسود والهيل والقرفة والقرنفل.',
      'ادویه گرام ماسالا: مخلوط ادویه‌های اصیل و معطر شامل زیره، گشنیز، فلفل سیاه، هل، دارچین، میخک و دانه‌های معطر دیگر.',
      'ګرم مساله مکس: د څو مسالو ګډ ترکیب چې زېره، دانیا، تور مرچ، الایچي، دارچیني، لونګ او نور خوشبویه مسالې پکې شاملې وي.',
      '{"en":"A blended spice product made from several whole or ground spices, commonly including cumin, coriander, black pepper, cardamom, cinnamon, cloves and similar aromatic spices.","ur":"گرم مصالحہ مکس: مختلف ثابت یا پسے ہوئے مصالحوں کا آمیزہ جس میں عام طور پر زیرہ، دھنیا، کالی مرچ، الائچی، دارچینی، لونگ اور دیگر معطر مصالحے شامل ہوتے ہیں۔","ar":"خلطة غرام ماسالا: منتج بهارات ممزوج ومُعد من توابل كاملة أو مطحونة، يشمل عادة الكمون والكزبرة والفلفل الأسود والهيل والقرفة والقرنفل.","fa":"ادویه گرام ماسالا: مخلوط ادویه‌های اصیل و معطر شامل زیره، گشنیز، فلفل سیاه، هل، دارچین، میخک و دانه‌های معطر دیگر.","ps":"ګرم مساله مکس: د څو مسالو ګډ ترکیب چې زېره، دانیا، تور مرچ، الایچي، دارچیني، لونګ او نور خوشبویه مسالې پکې شاملې وي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Other Mixed Spices
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Other Mixed Spices') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'A mixture made from two or more dried spices originating from different seeds, fruits, bark, roots, rhizomes, leaves or flower parts.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'A mixture made from two or more dried spices originating from different seeds, fruits, bark, roots, rhizomes, leaves or flower parts.',
      'en'::text,
      'A mixture made from two or more dried spices originating from different seeds, fruits, bark, roots, rhizomes, leaves or flower parts.',
      'دیگر مخلوط مصالحہ جات: دو یا زائد خشک مصالحوں کا آمیزہ جو مختلف بیجوں، پھلوں، چھال، جڑوں، پتوں یا پھولوں سے حاصل کیے گئے ہوں۔',
      'بهارات مشكلة أخرى: خلطة مجهزة من بهارين مجففين أو أكثر مستخرجة من بذور أو ثمار أو لحاء أو جذور أو أوراق مختلفة.',
      'سایر ادویه‌های ترکیبی: مخلوطی از دو یا چند ادویه خشک به دست آمده از دانه‌ها، پوسته‌ها، ریشه‌ها یا برگ‌های مختلف.',
      'نورې مخلوطې مسالې: د دوه یا ډېرو وچو مسالو ترکیب چې له بېلابېلو زړو، مېوو، پوټکو، ریښو یا پاڼو ترلاسه شوي وي.',
      '{"en":"A mixture made from two or more dried spices originating from different seeds, fruits, bark, roots, rhizomes, leaves or flower parts.","ur":"دیگر مخلوط مصالحہ جات: دو یا زائد خشک مصالحوں کا آمیزہ جو مختلف بیجوں، پھلوں، چھال، جڑوں، پتوں یا پھولوں سے حاصل کیے گئے ہوں۔","ar":"بهارات مشكلة أخرى: خلطة مجهزة من بهارين مجففين أو أكثر مستخرجة من بذور أو ثمار أو لحاء أو جذور أو أوراق مختلفة.","fa":"سایر ادویه‌های ترکیبی: مخلوطی از دو یا چند ادویه خشک به دست آمده از دانه‌ها، پوسته‌ها، ریشه‌ها یا برگ‌های مختلف.","ps":"نورې مخلوطې مسالې: د دوه یا ډېرو وچو مسالو ترکیب چې له بېلابېلو زړو، مېوو، پوټکو، ریښو یا پاڼو ترلاسه شوي وي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

  -- Other Single Spice
  FOR v_good IN
    SELECT id FROM public.goods
    WHERE lower(goods_name) = lower('Other Single Spice') AND deleted_at IS NULL
  LOOP
    -- 1. Update goods.extra_details
    UPDATE public.goods
    SET extra_details = 'Any individual dried spice obtained from one plant source, such as its seed, fruit, bark, leaf, flower, root or rhizome.',
        updated_at = NOW()
    WHERE id = v_good.id;

    -- 2. Upsert record_translations
    PERFORM public.upsert_record_translation(
      'goods'::text,
      v_good.id,
      'extra_details'::text,
      'Any individual dried spice obtained from one plant source, such as its seed, fruit, bark, leaf, flower, root or rhizome.',
      'en'::text,
      'Any individual dried spice obtained from one plant source, such as its seed, fruit, bark, leaf, flower, root or rhizome.',
      'دیگر واحد مصالحہ: کسی ایک پودے سے حاصل ہونے والا کوئی بھی انفرادی خشک مصالحہ، جیسے اس کا بیج، پھل، چھال، پتہ، پھول یا جڑ۔',
      'توابل مفردة أخرى: أي صنف بهارات مجفف مستقل مُستحصل عليه من مصدر نباتي واحد، كالبذرة أو الثمرة أو اللحاء أو الأوراق أو الجذور.',
      'سایر ادویه تکی: هر ادویه خشک منفرد که از یک منبع گیاهی مانند دانه، میوه، پوست، برگ، گل یا ریشه حاصل شده باشد.',
      'نورې جلا مسالې: هر ډول وچه مساله چې له یوه بوټي، لکه زړي، مېوې، پوټکي، پاڼې یا ریښې څخه ترلاسه شوې وي.',
      '{"en":"Any individual dried spice obtained from one plant source, such as its seed, fruit, bark, leaf, flower, root or rhizome.","ur":"دیگر واحد مصالحہ: کسی ایک پودے سے حاصل ہونے والا کوئی بھی انفرادی خشک مصالحہ، جیسے اس کا بیج، پھل، چھال، پتہ، پھول یا جڑ۔","ar":"توابل مفردة أخرى: أي صنف بهارات مجفف مستقل مُستحصل عليه من مصدر نباتي واحد، كالبذرة أو الثمرة أو اللحاء أو الأوراق أو الجذور.","fa":"سایر ادویه تکی: هر ادویه خشک منفرد که از یک منبع گیاهی مانند دانه، میوه، پوست، برگ، گل یا ریشه حاصل شده باشد.","ps":"نورې جلا مسالې: هر ډول وچه مساله چې له یوه بوټي، لکه زړي، مېوې، پوټکي، پاڼې یا ریښې څخه ترلاسه شوې وي."}'::jsonb,
      'manual'::text,
      'verified'::text,
      'human'::text,
      NULL::uuid
    );
  END LOOP;

END $$;
