-- Migration: Seed City Codes for Lead Scraping
-- Description: Populates city_codes table with NZ and AU cities for UberEats
-- Date: 2025-12-05

-- ============================================================================
-- NEW ZEALAND CITIES
-- ============================================================================

-- Auckland Region (auk)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('nz', 'Auckland', 'auckland', 'auk', 'auckland-auk'),
  ('nz', 'Beachlands', 'beachlands', 'auk', 'beachlands-auk'),
  ('nz', 'Bombay', 'bombay', 'auk', 'bombay-auk'),
  ('nz', 'Clevedon', 'clevedon', 'auk', 'clevedon-auk'),
  ('nz', 'Dairy Flat', 'dairy-flat', 'auk', 'dairy-flat-auk'),
  ('nz', 'Helensville', 'helensville', 'auk', 'helensville-auk'),
  ('nz', 'Karaka', 'karaka', 'auk', 'karaka-auk'),
  ('nz', 'Kumeu', 'kumeu', 'auk', 'kumeu-auk'),
  ('nz', 'Long Bay', 'long-bay', 'auk', 'long-bay-auk'),
  ('nz', 'Maraetai', 'maraetai', 'auk', 'maraetai-auk'),
  ('nz', 'Omaha', 'omaha', 'auk', 'omaha-auk'),
  ('nz', 'Orewa', 'orewa', 'auk', 'orewa-auk'),
  ('nz', 'Paerata', 'paerata', 'auk', 'paerata-auk'),
  ('nz', 'Parakai', 'parakai', 'auk', 'parakai-auk'),
  ('nz', 'Pukekohe', 'pukekohe', 'auk', 'pukekohe-auk'),
  ('nz', 'Puni', 'puni', 'auk', 'puni-auk'),
  ('nz', 'Ramarama', 'ramarama', 'auk', 'ramarama-auk'),
  ('nz', 'Rangitoto Island', 'rangitoto-island', 'auk', 'rangitoto-island-auk'),
  ('nz', 'Red Beach', 'red-beach', 'auk', 'red-beach-auk'),
  ('nz', 'Silverdale', 'silverdale', 'auk', 'silverdale-auk'),
  ('nz', 'Snells Beach', 'snells-beach', 'auk', 'snells-beach-auk'),
  ('nz', 'Stillwater', 'stillwater', 'auk', 'stillwater-auk'),
  ('nz', 'Swanson', 'swanson', 'auk', 'swanson-auk'),
  ('nz', 'Waimauku', 'waimauku', 'auk', 'waimauku-auk'),
  ('nz', 'Waiuku', 'waiuku', 'auk', 'waiuku-auk'),
  ('nz', 'Warkworth', 'warkworth', 'auk', 'warkworth-auk'),
  ('nz', 'Whangaparaoa', 'whangaparaoa', 'auk', 'whangaparaoa-auk'),
  ('nz', 'Whitford', 'whitford', 'auk', 'whitford-auk'),
  ('nz', 'Wainui', 'wainui', 'auk', 'wainui-auk')
on conflict (city_name, country) do nothing;

-- Bay of Plenty Region (bop)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('nz', 'Bowentown', 'bowentown', 'bop', 'bowentown-bop'),
  ('nz', 'Ngongotaha', 'ngongotaha', 'bop', 'ngongotaha-bop'),
  ('nz', 'Omanawa', 'omanawa', 'bop', 'omanawa-bop'),
  ('nz', 'Omokoroa', 'omokoroa', 'bop', 'omokoroa-bop'),
  ('nz', 'Otakiri', 'otakiri', 'bop', 'otakiri-bop'),
  ('nz', 'Papamoa', 'papamoa', 'bop', 'papamoa-bop'),
  ('nz', 'Pyes Pa', 'pyes-pa', 'bop', 'pyes-pa-bop'),
  ('nz', 'Rotorua', 'rotorua', 'bop', 'rotorua-bop'),
  ('nz', 'Tauranga', 'tauranga', 'bop', 'tauranga-bop'),
  ('nz', 'Te Puke', 'te-puke', 'bop', 'te-puke-bop'),
  ('nz', 'Te Puna', 'te-puna', 'bop', 'te-puna-bop'),
  ('nz', 'Welcome Bay', 'welcome-bay', 'bop', 'welcome-bay-bop'),
  ('nz', 'Whakamarama', 'whakamarama', 'bop', 'whakamarama-bop'),
  ('nz', 'Whakarewarewa', 'whakarewarewa', 'bop', 'whakarewarewa-bop'),
  ('nz', 'Whakatane', 'whakatane', 'bop', 'whakatane-bop')
on conflict (city_name, country) do nothing;

-- Canterbury Region (can)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('nz', 'Ashburton', 'ashburton', 'can', 'ashburton-can'),
  ('nz', 'Christchurch', 'christchurch', 'can', 'christchurch-can'),
  ('nz', 'Lincoln', 'lincoln', 'can', 'lincoln-can'),
  ('nz', 'Lyttelton', 'lyttelton', 'can', 'lyttelton-can'),
  ('nz', 'Ohoka', 'ohoka', 'can', 'ohoka-can'),
  ('nz', 'Pegasus', 'pegasus', 'can', 'pegasus-can'),
  ('nz', 'Prebbleton', 'prebbleton', 'can', 'prebbleton-can'),
  ('nz', 'Rangiora', 'rangiora', 'can', 'rangiora-can'),
  ('nz', 'Rolleston', 'rolleston', 'can', 'rolleston-can'),
  ('nz', 'Templeton', 'templeton', 'can', 'templeton-can'),
  ('nz', 'Timaru', 'timaru', 'can', 'timaru-can'),
  ('nz', 'Waikuku', 'waikuku', 'can', 'waikuku-can'),
  ('nz', 'West Melton', 'west-melton', 'can', 'west-melton-can'),
  ('nz', 'Woodend', 'woodend', 'can', 'woodend-can'),
  ('nz', 'Yaldhurst', 'yaldhurst', 'can', 'yaldhurst-can'),
  ('nz', 'Kaiapoi', 'kaiapoi', 'can', 'kaiapoi-can')
on conflict (city_name, country) do nothing;

-- Gisborne Region (gis)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('nz', 'Gisborne', 'gisborne', 'gis', 'gisborne-gis')
on conflict (city_name, country) do nothing;

-- Hawke's Bay Region (hkb)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('nz', 'Bay View', 'bay-view', 'hkb', 'bay-view-hkb'),
  ('nz', 'Flaxmere', 'flaxmere', 'hkb', 'flaxmere-hkb'),
  ('nz', 'Hastings', 'hastings', 'hkb', 'hastings-hkb'),
  ('nz', 'Havelock North', 'havelock-north', 'hkb', 'havelock-north-hkb'),
  ('nz', 'Meeanee', 'meeanee', 'hkb', 'meeanee-hkb'),
  ('nz', 'Napier', 'napier', 'hkb', 'napier-hkb'),
  ('nz', 'Waipukurau', 'waipukurau', 'hkb', 'waipukurau-hkb')
on conflict (city_name, country) do nothing;

-- Manawatu-Wanganui Region (mwt)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('nz', 'Bunnythorpe', 'bunnythorpe', 'mwt', 'bunnythorpe-mwt'),
  ('nz', 'Dannevirke', 'dannevirke', 'mwt', 'dannevirke-mwt'),
  ('nz', 'Feilding', 'feilding', 'mwt', 'feilding-mwt'),
  ('nz', 'Levin', 'levin', 'mwt', 'levin-mwt'),
  ('nz', 'Longburn', 'longburn', 'mwt', 'longburn-mwt'),
  ('nz', 'Okoia', 'okoia', 'mwt', 'okoia-mwt'),
  ('nz', 'Palmerston North', 'palmerston-north', 'mwt', 'palmerston-north-mwt'),
  ('nz', 'Whanganui', 'whanganui', 'mwt', 'whanganui-mwt')
on conflict (city_name, country) do nothing;

-- Marlborough Region (mbh)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('nz', 'Blenheim', 'blenheim', 'mbh', 'blenheim-mbh')
on conflict (city_name, country) do nothing;

-- Nelson Region (nsn)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('nz', 'Nelson', 'nelson', 'nsn', 'nelson-nsn')
on conflict (city_name, country) do nothing;

-- Northland Region (ntl)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('nz', 'Dargaville', 'dargaville', 'ntl', 'dargaville-ntl'),
  ('nz', 'Kaikohe', 'kaikohe', 'ntl', 'kaikohe-ntl'),
  ('nz', 'Kaitaia', 'kaitaia', 'ntl', 'kaitaia-ntl'),
  ('nz', 'Kerikeri', 'kerikeri', 'ntl', 'kerikeri-ntl'),
  ('nz', 'Waipapa', 'waipapa', 'ntl', 'waipapa-ntl'),
  ('nz', 'Whangarei', 'whangarei', 'ntl', 'whangarei-ntl'),
  ('nz', 'Kamo', 'kamo', 'ntl', 'kamo-ntl'),
  ('nz', 'Maunu', 'maunu', 'ntl', 'maunu-ntl'),
  ('nz', 'Ruakaka', 'ruakaka', 'ntl', 'ruakaka-ntl')
on conflict (city_name, country) do nothing;

-- Otago Region (ota)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('nz', 'Alexandra', 'alexandra', 'ota', 'alexandra-ota'),
  ('nz', 'Arrowtown', 'arrowtown', 'ota', 'arrowtown-ota'),
  ('nz', 'Arthurs Point', 'arthurs-point', 'ota', 'arthurs-point-ota'),
  ('nz', 'Cromwell', 'cromwell', 'ota', 'cromwell-ota'),
  ('nz', 'Dunedin', 'dunedin', 'ota', 'dunedin-ota'),
  ('nz', 'Jacks Point', 'jacks-point', 'ota', 'jacks-point-ota'),
  ('nz', 'Lower Shotover', 'lower-shotover', 'ota', 'lower-shotover-ota'),
  ('nz', 'Mosgiel', 'mosgiel', 'ota', 'mosgiel-ota'),
  ('nz', 'Oamaru', 'oamaru', 'ota', 'oamaru-ota'),
  ('nz', 'Port Chalmers', 'port-chalmers', 'ota', 'port-chalmers-ota'),
  ('nz', 'Queenstown', 'queenstown', 'ota', 'queenstown-ota'),
  ('nz', 'Wanaka', 'wanaka', 'ota', 'wanaka-ota'),
  ('nz', 'Lake Hayes', 'lake-hayes', 'ota', 'lake-hayes-ota')
on conflict (city_name, country) do nothing;

-- Taranaki Region (tki)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('nz', 'Bell Block', 'bell-block', 'tki', 'bell-block-tki'),
  ('nz', 'Cardiff', 'cardiff', 'tki', 'cardiff-tki'),
  ('nz', 'Hawera', 'hawera', 'tki', 'hawera-tki'),
  ('nz', 'Inglewood', 'inglewood', 'tki', 'inglewood-tki'),
  ('nz', 'New Plymouth', 'new-plymouth', 'tki', 'new-plymouth-tki'),
  ('nz', 'Stratford', 'stratford', 'tki', 'stratford-tki'),
  ('nz', 'Waitara', 'waitara', 'tki', 'waitara-tki')
on conflict (city_name, country) do nothing;

-- Tasman Region (tas) - NZ
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('nz', 'Appleby', 'appleby', 'tas', 'appleby-tas'),
  ('nz', 'Hope', 'hope', 'tas', 'hope-tas'),
  ('nz', 'Motueka', 'motueka', 'tas', 'motueka-tas'),
  ('nz', 'Richmond', 'richmond', 'tas', 'richmond-tas')
on conflict (city_name, country) do nothing;

-- Waikato Region (wko)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('nz', 'Cambridge', 'cambridge', 'wko', 'cambridge-wko'),
  ('nz', 'Gordonton', 'gordonton', 'wko', 'gordonton-wko'),
  ('nz', 'Hamilton', 'hamilton', 'wko', 'hamilton-wko'),
  ('nz', 'Huntly', 'huntly', 'wko', 'huntly-wko'),
  ('nz', 'Kihikihi', 'kihikihi', 'wko', 'kihikihi-wko'),
  ('nz', 'Matamata', 'matamata', 'wko', 'matamata-wko'),
  ('nz', 'Mercer', 'mercer', 'wko', 'mercer-wko'),
  ('nz', 'Morrinsville', 'morrinsville', 'wko', 'morrinsville-wko'),
  ('nz', 'Newstead', 'newstead', 'wko', 'newstead-wko'),
  ('nz', 'Ngaruawahia', 'ngaruawahia', 'wko', 'ngaruawahia-wko'),
  ('nz', 'Nukuhau', 'nukuhau', 'wko', 'nukuhau-wko'),
  ('nz', 'Pokeno', 'pokeno', 'wko', 'pokeno-wko'),
  ('nz', 'Tamahere', 'tamahere', 'wko', 'tamahere-wko'),
  ('nz', 'Taupiri', 'taupiri', 'wko', 'taupiri-wko'),
  ('nz', 'Taupo', 'taupo', 'wko', 'taupo-wko'),
  ('nz', 'Te Awamutu', 'te-awamutu', 'wko', 'te-awamutu-wko'),
  ('nz', 'Te Kowhai', 'te-kowhai', 'wko', 'te-kowhai-wko'),
  ('nz', 'Te Kuiti', 'te-kuiti', 'wko', 'te-kuiti-wko'),
  ('nz', 'Thames', 'thames', 'wko', 'thames-wko'),
  ('nz', 'Tokoroa', 'tokoroa', 'wko', 'tokoroa-wko'),
  ('nz', 'Tuakau', 'tuakau', 'wko', 'tuakau-wko'),
  ('nz', 'Waihi', 'waihi', 'wko', 'waihi-wko'),
  ('nz', 'Whitianga', 'whitianga', 'wko', 'whitianga-wko')
on conflict (city_name, country) do nothing;

-- Wellington Region (wgn)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('nz', 'Carterton', 'carterton', 'wgn', 'carterton-wgn'),
  ('nz', 'Kuripuni', 'kuripuni', 'wgn', 'kuripuni-wgn'),
  ('nz', 'Lansdowne', 'lansdowne', 'wgn', 'lansdowne-wgn'),
  ('nz', 'Lower Hutt', 'lower-hutt', 'wgn', 'lower-hutt-wgn'),
  ('nz', 'Otaki', 'otaki', 'wgn', 'otaki-wgn'),
  ('nz', 'Paraparaumu', 'paraparaumu', 'wgn', 'paraparaumu-wgn'),
  ('nz', 'Porirua', 'porirua', 'wgn', 'porirua-wgn'),
  ('nz', 'Solway', 'solway', 'wgn', 'solway-wgn'),
  ('nz', 'Upper Hutt', 'upper-hutt', 'wgn', 'upper-hutt-wgn'),
  ('nz', 'Wellington', 'wellington', 'wgn', 'wellington-wgn'),
  ('nz', 'Masterton', 'masterton', 'wgn', 'masterton-wgn')
on conflict (city_name, country) do nothing;

-- West Coast Region (wtc)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('nz', 'Greymouth', 'greymouth', 'wtc', 'greymouth-wtc'),
  ('nz', 'Paroa', 'paroa', 'wtc', 'paroa-wtc')
on conflict (city_name, country) do nothing;

-- Southland Region (stl)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('nz', 'Gore', 'gore', 'stl', 'gore-stl'),
  ('nz', 'Otatara', 'otatara', 'stl', 'otatara-stl'),
  ('nz', 'Invercargill', 'invercargill', 'stl', 'invercargill-stl')
on conflict (city_name, country) do nothing;


-- ============================================================================
-- AUSTRALIAN CITIES
-- ============================================================================

-- Australian Capital Territory (act)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('au', 'Canberra', 'canberra', 'act', 'canberra-act'),
  ('au', 'Hall', 'hall', 'act', 'hall-act')
on conflict (city_name, country) do nothing;

-- New South Wales (nsw)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('au', 'Albury', 'albury', 'nsw', 'albury-nsw'),
  ('au', 'Alstonville', 'alstonville', 'nsw', 'alstonville-nsw'),
  ('au', 'Appin', 'appin', 'nsw', 'appin-nsw'),
  ('au', 'Armidale', 'armidale', 'nsw', 'armidale-nsw'),
  ('au', 'Ballina', 'ballina', 'nsw', 'ballina-nsw'),
  ('au', 'Batemans Bay', 'batemans-bay', 'nsw', 'batemans-bay-nsw'),
  ('au', 'Bathurst', 'bathurst', 'nsw', 'bathurst-nsw'),
  ('au', 'Bega', 'bega', 'nsw', 'bega-nsw'),
  ('au', 'Belimbla Park', 'belimbla-park', 'nsw', 'belimbla-park-nsw'),
  ('au', 'Blue Mountains', 'blue-mountains', 'nsw', 'blue-mountains-nsw'),
  ('au', 'Bonny Hills', 'bonny-hills', 'nsw', 'bonny-hills-nsw'),
  ('au', 'Bowral - Mittagong', 'bowral---mittagong', 'nsw', 'bowral---mittagong-nsw'),
  ('au', 'Branxton', 'branxton', 'nsw', 'branxton-nsw'),
  ('au', 'Broke', 'broke', 'nsw', 'broke-nsw'),
  ('au', 'Broken Hill', 'broken-hill', 'nsw', 'broken-hill-nsw'),
  ('au', 'Bungendore', 'bungendore', 'nsw', 'bungendore-nsw'),
  ('au', 'Byron Bay', 'byron-bay', 'nsw', 'byron-bay-nsw'),
  ('au', 'Camden Haven', 'camden-haven', 'nsw', 'camden-haven-nsw'),
  ('au', 'Casino', 'casino', 'nsw', 'casino-nsw'),
  ('au', 'Catherine Field', 'catherine-field', 'nsw', 'catherine-field-nsw'),
  ('au', 'Central Coast', 'central-coast', 'nsw', 'central-coast-nsw'),
  ('au', 'Cessnock', 'cessnock', 'nsw', 'cessnock-nsw'),
  ('au', 'Coffs Harbour', 'coffs-harbour', 'nsw', 'coffs-harbour-nsw'),
  ('au', 'Cooma', 'cooma', 'nsw', 'cooma-nsw'),
  ('au', 'Cowra', 'cowra', 'nsw', 'cowra-nsw'),
  ('au', 'Deniliquin', 'deniliquin', 'nsw', 'deniliquin-nsw'),
  ('au', 'Douglas Park', 'douglas-park', 'nsw', 'douglas-park-nsw'),
  ('au', 'Dubbo', 'dubbo', 'nsw', 'dubbo-nsw'),
  ('au', 'Estella', 'estella', 'nsw', 'estella-nsw'),
  ('au', 'Forbes', 'forbes', 'nsw', 'forbes-nsw'),
  ('au', 'Forest Hill', 'forest-hill', 'nsw', 'forest-hill-nsw'),
  ('au', 'Forster - Tuncurry', 'forster---tuncurry', 'nsw', 'forster---tuncurry-nsw'),
  ('au', 'Freemans Reach', 'freemans-reach', 'nsw', 'freemans-reach-nsw'),
  ('au', 'Galston', 'galston', 'nsw', 'galston-nsw'),
  ('au', 'Gillieston Heights', 'gillieston-heights', 'nsw', 'gillieston-heights-nsw'),
  ('au', 'Glen Innes', 'glen-innes', 'nsw', 'glen-innes-nsw'),
  ('au', 'Glenorie', 'glenorie', 'nsw', 'glenorie-nsw'),
  ('au', 'Glossodia', 'glossodia', 'nsw', 'glossodia-nsw'),
  ('au', 'Goulburn', 'goulburn', 'nsw', 'goulburn-nsw'),
  ('au', 'Grafton', 'grafton', 'nsw', 'grafton-nsw'),
  ('au', 'Greta', 'greta', 'nsw', 'greta-nsw'),
  ('au', 'Griffith', 'griffith', 'nsw', 'griffith-nsw'),
  ('au', 'Gunnedah', 'gunnedah', 'nsw', 'gunnedah-nsw'),
  ('au', 'Hastings Point', 'hastings-point', 'nsw', 'hastings-point-nsw'),
  ('au', 'Heddon Greta', 'heddon-greta', 'nsw', 'heddon-greta-nsw'),
  ('au', 'Huskisson', 'huskisson', 'nsw', 'huskisson-nsw'),
  ('au', 'Inverell', 'inverell', 'nsw', 'inverell-nsw'),
  ('au', 'Kempsey', 'kempsey', 'nsw', 'kempsey-nsw'),
  ('au', 'Kiama', 'kiama', 'nsw', 'kiama-nsw'),
  ('au', 'Kurmond', 'kurmond', 'nsw', 'kurmond-nsw'),
  ('au', 'Kurrajong', 'kurrajong', 'nsw', 'kurrajong-nsw'),
  ('au', 'Kurrajong Heights', 'kurrajong-heights', 'nsw', 'kurrajong-heights-nsw'),
  ('au', 'Kurri Kurri - Weston', 'kurri-kurri---weston', 'nsw', 'kurri-kurri---weston-nsw'),
  ('au', 'Lake Cathie', 'lake-cathie', 'nsw', 'lake-cathie-nsw'),
  ('au', 'Leeton', 'leeton', 'nsw', 'leeton-nsw'),
  ('au', 'Lennox Head', 'lennox-head', 'nsw', 'lennox-head-nsw'),
  ('au', 'Leppington', 'leppington', 'nsw', 'leppington-nsw'),
  ('au', 'Lismore', 'lismore', 'nsw', 'lismore-nsw'),
  ('au', 'Lithgow', 'lithgow', 'nsw', 'lithgow-nsw'),
  ('au', 'Luddenham', 'luddenham', 'nsw', 'luddenham-nsw'),
  ('au', 'Maitland', 'maitland', 'nsw', 'maitland-nsw'),
  ('au', 'Medlow Bath', 'medlow-bath', 'nsw', 'medlow-bath-nsw'),
  ('au', 'Medowie', 'medowie', 'nsw', 'medowie-nsw'),
  ('au', 'Menangle', 'menangle', 'nsw', 'menangle-nsw'),
  ('au', 'Merimbula', 'merimbula', 'nsw', 'merimbula-nsw'),
  ('au', 'Milton', 'milton', 'nsw', 'milton-nsw'),
  ('au', 'Moama', 'moama', 'nsw', 'moama-nsw'),
  ('au', 'Moonee Beach', 'moonee-beach', 'nsw', 'moonee-beach-nsw'),
  ('au', 'Moree', 'moree', 'nsw', 'moree-nsw'),
  ('au', 'Morisset - Cooranbong', 'morisset---cooranbong', 'nsw', 'morisset---cooranbong-nsw'),
  ('au', 'Moss Vale', 'moss-vale', 'nsw', 'moss-vale-nsw'),
  ('au', 'Mount Vernon', 'mount-vernon', 'nsw', 'mount-vernon-nsw'),
  ('au', 'Mudgee', 'mudgee', 'nsw', 'mudgee-nsw'),
  ('au', 'Mulgoa', 'mulgoa', 'nsw', 'mulgoa-nsw'),
  ('au', 'Mulwala', 'mulwala', 'nsw', 'mulwala-nsw'),
  ('au', 'Murwillumbah', 'murwillumbah', 'nsw', 'murwillumbah-nsw'),
  ('au', 'Muswellbrook', 'muswellbrook', 'nsw', 'muswellbrook-nsw'),
  ('au', 'Narrabri', 'narrabri', 'nsw', 'narrabri-nsw'),
  ('au', 'Nelson Bay - Corlette', 'nelson-bay---corlette', 'nsw', 'nelson-bay---corlette-nsw'),
  ('au', 'Newcastle', 'newcastle', 'nsw', 'newcastle-nsw'),
  ('au', 'Nowra - Bomaderry', 'nowra---bomaderry', 'nsw', 'nowra---bomaderry-nsw'),
  ('au', 'Old Erowal Bay', 'old-erowal-bay', 'nsw', 'old-erowal-bay-nsw'),
  ('au', 'Orange', 'orange', 'nsw', 'orange-nsw'),
  ('au', 'Pambula', 'pambula', 'nsw', 'pambula-nsw'),
  ('au', 'Parkes', 'parkes', 'nsw', 'parkes-nsw'),
  ('au', 'Picton', 'picton', 'nsw', 'picton-nsw'),
  ('au', 'Pitt Town', 'pitt-town', 'nsw', 'pitt-town-nsw'),
  ('au', 'Port Macquarie', 'port-macquarie', 'nsw', 'port-macquarie-nsw'),
  ('au', 'Pottsville', 'pottsville', 'nsw', 'pottsville-nsw'),
  ('au', 'Queanbeyan', 'queanbeyan', 'nsw', 'queanbeyan-nsw'),
  ('au', 'Raymond Terrace', 'raymond-terrace', 'nsw', 'raymond-terrace-nsw'),
  ('au', 'Richmond North', 'richmond-north', 'nsw', 'richmond-north-nsw'),
  ('au', 'Salamander Bay - Soldiers Point', 'salamander-bay---soldiers-point', 'nsw', 'salamander-bay---soldiers-point-nsw'),
  ('au', 'Salt Ash', 'salt-ash', 'nsw', 'salt-ash-nsw'),
  ('au', 'Sandy Beach - Emerald Beach', 'sandy-beach---emerald-beach', 'nsw', 'sandy-beach---emerald-beach-nsw'),
  ('au', 'Scone', 'scone', 'nsw', 'scone-nsw'),
  ('au', 'Shoal Bay', 'shoal-bay', 'nsw', 'shoal-bay-nsw'),
  ('au', 'Silverdale - Warragamba', 'silverdale---warragamba', 'nsw', 'silverdale---warragamba-nsw'),
  ('au', 'Singleton', 'singleton', 'nsw', 'singleton-nsw'),
  ('au', 'St Georges Basin - Sanctuary Point', 'st-georges-basin---sanctuary-point', 'nsw', 'st-georges-basin---sanctuary-point-nsw'),
  ('au', 'Suffolk Park', 'suffolk-park', 'nsw', 'suffolk-park-nsw'),
  ('au', 'Sydney', 'sydney', 'nsw', 'sydney-nsw'),
  ('au', 'Tahmoor', 'tahmoor', 'nsw', 'tahmoor-nsw'),
  ('au', 'Tamworth', 'tamworth', 'nsw', 'tamworth-nsw'),
  ('au', 'Taree', 'taree', 'nsw', 'taree-nsw'),
  ('au', 'Temora', 'temora', 'nsw', 'temora-nsw'),
  ('au', 'The Oaks', 'the-oaks', 'nsw', 'the-oaks-nsw'),
  ('au', 'Thirlmere', 'thirlmere', 'nsw', 'thirlmere-nsw'),
  ('au', 'Tomago', 'tomago', 'nsw', 'tomago-nsw'),
  ('au', 'Tweed Heads', 'tweed-heads', 'nsw', 'tweed-heads-nsw'),
  ('au', 'Ulladulla', 'ulladulla', 'nsw', 'ulladulla-nsw'),
  ('au', 'Uranquinty', 'uranquinty', 'nsw', 'uranquinty-nsw'),
  ('au', 'Vincentia', 'vincentia', 'nsw', 'vincentia-nsw'),
  ('au', 'Wagga Wagga', 'wagga-wagga', 'nsw', 'wagga-wagga-nsw'),
  ('au', 'Wauchope', 'wauchope', 'nsw', 'wauchope-nsw'),
  ('au', 'Wellington', 'wellington', 'nsw', 'wellington-nsw'),
  ('au', 'Wilberforce', 'wilberforce', 'nsw', 'wilberforce-nsw'),
  ('au', 'Wilton', 'wilton', 'nsw', 'wilton-nsw'),
  ('au', 'Wingham', 'wingham', 'nsw', 'wingham-nsw'),
  ('au', 'Wollongong', 'wollongong', 'nsw', 'wollongong-nsw'),
  ('au', 'Woolgoolga', 'woolgoolga', 'nsw', 'woolgoolga-nsw'),
  ('au', 'Wyee', 'wyee', 'nsw', 'wyee-nsw'),
  ('au', 'Wyong', 'wyong', 'nsw', 'wyong-nsw'),
  ('au', 'Yamba', 'yamba', 'nsw', 'yamba-nsw'),
  ('au', 'Yass', 'yass', 'nsw', 'yass-nsw'),
  ('au', 'Young', 'young', 'nsw', 'young-nsw')
on conflict (city_name, country) do nothing;

-- Northern Territory (nt)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('au', 'Alice Springs', 'alice-springs', 'nt', 'alice-springs-nt'),
  ('au', 'Darwin', 'darwin', 'nt', 'darwin-nt'),
  ('au', 'Humpty Doo', 'humpty-doo', 'nt', 'humpty-doo-nt'),
  ('au', 'Tennant Creek', 'tennant-creek', 'nt', 'tennant-creek-nt')
on conflict (city_name, country) do nothing;

-- Queensland (qld)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('au', 'Airlie Beach - Cannonvale', 'airlie-beach---cannonvale', 'qld', 'airlie-beach---cannonvale-qld'),
  ('au', 'Atherton', 'atherton', 'qld', 'atherton-qld'),
  ('au', 'Ayr', 'ayr', 'qld', 'ayr-qld'),
  ('au', 'Bargara - Innes Park', 'bargara---innes-park', 'qld', 'bargara---innes-park-qld'),
  ('au', 'Beachmere', 'beachmere', 'qld', 'beachmere-qld'),
  ('au', 'Beaudesert', 'beaudesert', 'qld', 'beaudesert-qld'),
  ('au', 'Beerwah', 'beerwah', 'qld', 'beerwah-qld'),
  ('au', 'Blackwater', 'blackwater', 'qld', 'blackwater-qld'),
  ('au', 'Bongaree - Woorim', 'bongaree---woorim', 'qld', 'bongaree---woorim-qld'),
  ('au', 'Bowen', 'bowen', 'qld', 'bowen-qld'),
  ('au', 'Brandon', 'brandon', 'qld', 'brandon-qld'),
  ('au', 'Brisbane', 'brisbane', 'qld', 'brisbane-qld'),
  ('au', 'Bundaberg', 'bundaberg', 'qld', 'bundaberg-qld'),
  ('au', 'Burnett Heads', 'burnett-heads', 'qld', 'burnett-heads-qld'),
  ('au', 'Cairns', 'cairns', 'qld', 'cairns-qld'),
  ('au', 'Calliope', 'calliope', 'qld', 'calliope-qld'),
  ('au', 'Chinchilla', 'chinchilla', 'qld', 'chinchilla-qld'),
  ('au', 'Cooroy', 'cooroy', 'qld', 'cooroy-qld'),
  ('au', 'Dalby', 'dalby', 'qld', 'dalby-qld'),
  ('au', 'Doonan - Tinbeerwah', 'doonan---tinbeerwah', 'qld', 'doonan---tinbeerwah-qld'),
  ('au', 'Emerald', 'emerald', 'qld', 'emerald-qld'),
  ('au', 'Emu Park', 'emu-park', 'qld', 'emu-park-qld'),
  ('au', 'Eumundi', 'eumundi', 'qld', 'eumundi-qld'),
  ('au', 'Gatton', 'gatton', 'qld', 'gatton-qld'),
  ('au', 'Gladstone', 'gladstone', 'qld', 'gladstone-qld'),
  ('au', 'Glass House Mountains', 'glass-house-mountains', 'qld', 'glass-house-mountains-qld'),
  ('au', 'Gold Coast', 'gold-coast', 'qld', 'gold-coast-qld'),
  ('au', 'Gordonvale', 'gordonvale', 'qld', 'gordonvale-qld'),
  ('au', 'Gracemere', 'gracemere', 'qld', 'gracemere-qld'),
  ('au', 'Gympie', 'gympie', 'qld', 'gympie-qld'),
  ('au', 'Hervey Bay', 'hervey-bay', 'qld', 'hervey-bay-qld'),
  ('au', 'Highfields', 'highfields', 'qld', 'highfields-qld'),
  ('au', 'Ingham', 'ingham', 'qld', 'ingham-qld'),
  ('au', 'Innisfail', 'innisfail', 'qld', 'innisfail-qld'),
  ('au', 'Jacobs Well', 'jacobs-well', 'qld', 'jacobs-well-qld'),
  ('au', 'Jimboomba', 'jimboomba', 'qld', 'jimboomba-qld'),
  ('au', 'Jimboomba - West', 'jimboomba---west', 'qld', 'jimboomba---west-qld'),
  ('au', 'Kingaroy', 'kingaroy', 'qld', 'kingaroy-qld'),
  ('au', 'Kinka Beach', 'kinka-beach', 'qld', 'kinka-beach-qld'),
  ('au', 'Kuranda', 'kuranda', 'qld', 'kuranda-qld'),
  ('au', 'Landsborough', 'landsborough', 'qld', 'landsborough-qld'),
  ('au', 'Logan Village', 'logan-village', 'qld', 'logan-village-qld'),
  ('au', 'Mackay', 'mackay', 'qld', 'mackay-qld'),
  ('au', 'Maleny', 'maleny', 'qld', 'maleny-qld'),
  ('au', 'Marburg', 'marburg', 'qld', 'marburg-qld'),
  ('au', 'Mareeba', 'mareeba', 'qld', 'mareeba-qld'),
  ('au', 'Maryborough', 'maryborough', 'qld', 'maryborough-qld'),
  ('au', 'Mooloolah', 'mooloolah', 'qld', 'mooloolah-qld'),
  ('au', 'Moore Park', 'moore-park', 'qld', 'moore-park-qld'),
  ('au', 'Moranbah', 'moranbah', 'qld', 'moranbah-qld'),
  ('au', 'Mount Cotton', 'mount-cotton', 'qld', 'mount-cotton-qld'),
  ('au', 'Mount Isa', 'mount-isa', 'qld', 'mount-isa-qld'),
  ('au', 'Mount Nathan', 'mount-nathan', 'qld', 'mount-nathan-qld'),
  ('au', 'Nambour', 'nambour', 'qld', 'nambour-qld'),
  ('au', 'Palmwoods', 'palmwoods', 'qld', 'palmwoods-qld'),
  ('au', 'Plainland', 'plainland', 'qld', 'plainland-qld'),
  ('au', 'Port Douglas - Craiglie', 'port-douglas---craiglie', 'qld', 'port-douglas---craiglie-qld'),
  ('au', 'Rockhampton', 'rockhampton', 'qld', 'rockhampton-qld'),
  ('au', 'Roma', 'roma', 'qld', 'roma-qld'),
  ('au', 'Samford Valley - Highvale', 'samford-valley---highvale', 'qld', 'samford-valley---highvale-qld'),
  ('au', 'Samford Village', 'samford-village', 'qld', 'samford-village-qld'),
  ('au', 'Sandstone Point - Ningi', 'sandstone-point---ningi', 'qld', 'sandstone-point---ningi-qld'),
  ('au', 'Sarina', 'sarina', 'qld', 'sarina-qld'),
  ('au', 'Stanthorpe', 'stanthorpe', 'qld', 'stanthorpe-qld'),
  ('au', 'Sunshine Coast', 'sunshine-coast', 'qld', 'sunshine-coast-qld'),
  ('au', 'Tamborine Mountain', 'tamborine-mountain', 'qld', 'tamborine-mountain-qld'),
  ('au', 'Tannum Sands Boyne Island', 'tannum-sands-boyne-island', 'qld', 'tannum-sands-boyne-island-qld'),
  ('au', 'Toorbul', 'toorbul', 'qld', 'toorbul-qld'),
  ('au', 'Toowoomba', 'toowoomba', 'qld', 'toowoomba-qld'),
  ('au', 'Townsville', 'townsville', 'qld', 'townsville-qld'),
  ('au', 'Walloon', 'walloon', 'qld', 'walloon-qld'),
  ('au', 'Warwick', 'warwick', 'qld', 'warwick-qld'),
  ('au', 'Westbrook', 'westbrook', 'qld', 'westbrook-qld'),
  ('au', 'Withcott', 'withcott', 'qld', 'withcott-qld'),
  ('au', 'Yandina', 'yandina', 'qld', 'yandina-qld'),
  ('au', 'Yeppoon', 'yeppoon', 'qld', 'yeppoon-qld')
on conflict (city_name, country) do nothing;

-- South Australia (sa)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('au', 'Adelaide', 'adelaide', 'sa', 'adelaide-sa'),
  ('au', 'Aldinga', 'aldinga', 'sa', 'aldinga-sa'),
  ('au', 'Angaston', 'angaston', 'sa', 'angaston-sa'),
  ('au', 'Angle Vale', 'angle-vale', 'sa', 'angle-vale-sa'),
  ('au', 'Balhannah', 'balhannah', 'sa', 'balhannah-sa'),
  ('au', 'Berri', 'berri', 'sa', 'berri-sa'),
  ('au', 'Callington', 'callington', 'sa', 'callington-sa'),
  ('au', 'Crafers - Bridgewater', 'crafers---bridgewater', 'sa', 'crafers---bridgewater-sa'),
  ('au', 'Gawler', 'gawler', 'sa', 'gawler-sa'),
  ('au', 'Hahndorf', 'hahndorf', 'sa', 'hahndorf-sa'),
  ('au', 'Kadina', 'kadina', 'sa', 'kadina-sa'),
  ('au', 'McLaren Vale', 'mclaren-vale', 'sa', 'mclaren-vale-sa'),
  ('au', 'Mount Barker', 'mount-barker', 'sa', 'mount-barker-sa'),
  ('au', 'Mount Gambier', 'mount-gambier', 'sa', 'mount-gambier-sa'),
  ('au', 'Murray Bridge', 'murray-bridge', 'sa', 'murray-bridge-sa'),
  ('au', 'Nairne', 'nairne', 'sa', 'nairne-sa'),
  ('au', 'Naracoorte', 'naracoorte', 'sa', 'naracoorte-sa'),
  ('au', 'Nuriootpa', 'nuriootpa', 'sa', 'nuriootpa-sa'),
  ('au', 'Port Augusta', 'port-augusta', 'sa', 'port-augusta-sa'),
  ('au', 'Port Lincoln', 'port-lincoln', 'sa', 'port-lincoln-sa'),
  ('au', 'Port Pirie', 'port-pirie', 'sa', 'port-pirie-sa'),
  ('au', 'Renmark', 'renmark', 'sa', 'renmark-sa'),
  ('au', 'Strathalbyn', 'strathalbyn', 'sa', 'strathalbyn-sa'),
  ('au', 'Tanunda', 'tanunda', 'sa', 'tanunda-sa'),
  ('au', 'Two Wells', 'two-wells', 'sa', 'two-wells-sa'),
  ('au', 'Victor Harbor - Goolwa', 'victor-harbor---goolwa', 'sa', 'victor-harbor---goolwa-sa'),
  ('au', 'Virginia', 'virginia', 'sa', 'virginia-sa'),
  ('au', 'Wallaroo', 'wallaroo', 'sa', 'wallaroo-sa'),
  ('au', 'Whyalla', 'whyalla', 'sa', 'whyalla-sa'),
  ('au', 'Willunga', 'willunga', 'sa', 'willunga-sa')
on conflict (city_name, country) do nothing;

-- Tasmania (tas) - Australia
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('au', 'Burnie - Somerset', 'burnie---somerset', 'tas', 'burnie---somerset-tas'),
  ('au', 'Devonport', 'devonport', 'tas', 'devonport-tas'),
  ('au', 'Hobart', 'hobart', 'tas', 'hobart-tas'),
  ('au', 'Huonville', 'huonville', 'tas', 'huonville-tas'),
  ('au', 'Latrobe', 'latrobe', 'tas', 'latrobe-tas'),
  ('au', 'Launceston', 'launceston', 'tas', 'launceston-tas'),
  ('au', 'Legana', 'legana', 'tas', 'legana-tas'),
  ('au', 'Margate', 'margate', 'tas', 'margate-tas'),
  ('au', 'New Norfolk', 'new-norfolk', 'tas', 'new-norfolk-tas'),
  ('au', 'Ranelagh', 'ranelagh', 'tas', 'ranelagh-tas'),
  ('au', 'Snug', 'snug', 'tas', 'snug-tas'),
  ('au', 'Sorell', 'sorell', 'tas', 'sorell-tas'),
  ('au', 'Ulverstone', 'ulverstone', 'tas', 'ulverstone-tas'),
  ('au', 'Richmond', 'richmond', 'tas', 'richmond-tas')
on conflict (city_name, country) do nothing;

-- Victoria (vic)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('au', 'Ararat', 'ararat', 'vic', 'ararat-vic'),
  ('au', 'Bacchus Marsh', 'bacchus-marsh', 'vic', 'bacchus-marsh-vic'),
  ('au', 'Bairnsdale', 'bairnsdale', 'vic', 'bairnsdale-vic'),
  ('au', 'Ballarat', 'ballarat', 'vic', 'ballarat-vic'),
  ('au', 'Balnarring Beach', 'balnarring-beach', 'vic', 'balnarring-beach-vic'),
  ('au', 'Bannockburn', 'bannockburn', 'vic', 'bannockburn-vic'),
  ('au', 'Baranduda', 'baranduda', 'vic', 'baranduda-vic'),
  ('au', 'Beaconsfield Upper', 'beaconsfield-upper', 'vic', 'beaconsfield-upper-vic'),
  ('au', 'Benalla', 'benalla', 'vic', 'benalla-vic'),
  ('au', 'Bendigo', 'bendigo', 'vic', 'bendigo-vic'),
  ('au', 'Broadford', 'broadford', 'vic', 'broadford-vic'),
  ('au', 'Bulla', 'bulla', 'vic', 'bulla-vic'),
  ('au', 'Castlemaine', 'castlemaine', 'vic', 'castlemaine-vic'),
  ('au', 'Clyde', 'clyde', 'vic', 'clyde-vic'),
  ('au', 'Cobram', 'cobram', 'vic', 'cobram-vic'),
  ('au', 'Colac', 'colac', 'vic', 'colac-vic'),
  ('au', 'Cowes', 'cowes', 'vic', 'cowes-vic'),
  ('au', 'Diggers Rest', 'diggers-rest', 'vic', 'diggers-rest-vic'),
  ('au', 'Drouin', 'drouin', 'vic', 'drouin-vic'),
  ('au', 'Drysdale - Clifton Springs', 'drysdale---clifton-springs', 'vic', 'drysdale---clifton-springs-vic'),
  ('au', 'Echuca', 'echuca', 'vic', 'echuca-vic'),
  ('au', 'Euroa', 'euroa', 'vic', 'euroa-vic'),
  ('au', 'Geelong', 'geelong', 'vic', 'geelong-vic'),
  ('au', 'Gembrook', 'gembrook', 'vic', 'gembrook-vic'),
  ('au', 'Gisborne', 'gisborne', 'vic', 'gisborne-vic'),
  ('au', 'Hamilton', 'hamilton', 'vic', 'hamilton-vic'),
  ('au', 'Healesville', 'healesville', 'vic', 'healesville-vic'),
  ('au', 'Horsham', 'horsham', 'vic', 'horsham-vic'),
  ('au', 'Inverloch', 'inverloch', 'vic', 'inverloch-vic'),
  ('au', 'Kilmore', 'kilmore', 'vic', 'kilmore-vic'),
  ('au', 'Koo Wee Rup', 'koo-wee-rup', 'vic', 'koo-wee-rup-vic'),
  ('au', 'Lara', 'lara', 'vic', 'lara-vic'),
  ('au', 'Leopold', 'leopold', 'vic', 'leopold-vic'),
  ('au', 'Little River', 'little-river', 'vic', 'little-river-vic'),
  ('au', 'Longwarry', 'longwarry', 'vic', 'longwarry-vic'),
  ('au', 'Maffra', 'maffra', 'vic', 'maffra-vic'),
  ('au', 'Maryborough', 'maryborough', 'vic', 'maryborough-vic'),
  ('au', 'Melbourne', 'melbourne', 'vic', 'melbourne-vic'),
  ('au', 'Melton', 'melton', 'vic', 'melton-vic'),
  ('au', 'Mildura', 'mildura', 'vic', 'mildura-vic'),
  ('au', 'Moama', 'moama', 'vic', 'moama-vic'),
  ('au', 'Moe Newborough', 'moe-newborough', 'vic', 'moe-newborough-vic'),
  ('au', 'Morwell', 'morwell', 'vic', 'morwell-vic'),
  ('au', 'Ocean Grove - Barwon Heads', 'ocean-grove---barwon-heads', 'vic', 'ocean-grove---barwon-heads-vic'),
  ('au', 'Officer', 'officer', 'vic', 'officer-vic'),
  ('au', 'Pakenham', 'pakenham', 'vic', 'pakenham-vic'),
  ('au', 'Point Lonsdale - Queenscliff', 'point-lonsdale---queenscliff', 'vic', 'point-lonsdale---queenscliff-vic'),
  ('au', 'Portarlington', 'portarlington', 'vic', 'portarlington-vic'),
  ('au', 'Portland', 'portland', 'vic', 'portland-vic'),
  ('au', 'Red Hill South', 'red-hill-south', 'vic', 'red-hill-south-vic'),
  ('au', 'Riddells Creek', 'riddells-creek', 'vic', 'riddells-creek-vic'),
  ('au', 'Rockbank', 'rockbank', 'vic', 'rockbank-vic'),
  ('au', 'Sale', 'sale', 'vic', 'sale-vic'),
  ('au', 'San Remo', 'san-remo', 'vic', 'san-remo-vic'),
  ('au', 'Seville', 'seville', 'vic', 'seville-vic'),
  ('au', 'Seymour', 'seymour', 'vic', 'seymour-vic'),
  ('au', 'Shepparton - Mooroopna', 'shepparton---mooroopna', 'vic', 'shepparton---mooroopna-vic'),
  ('au', 'St Leonards', 'st-leonards', 'vic', 'st-leonards-vic'),
  ('au', 'Stawell', 'stawell', 'vic', 'stawell-vic'),
  ('au', 'Sunbury', 'sunbury', 'vic', 'sunbury-vic'),
  ('au', 'Swan Hill', 'swan-hill', 'vic', 'swan-hill-vic'),
  ('au', 'Tooradin', 'tooradin', 'vic', 'tooradin-vic'),
  ('au', 'Torquay - Jan Juc', 'torquay---jan-juc', 'vic', 'torquay---jan-juc-vic'),
  ('au', 'Trafalgar', 'trafalgar', 'vic', 'trafalgar-vic'),
  ('au', 'Traralgon', 'traralgon', 'vic', 'traralgon-vic'),
  ('au', 'Wallan', 'wallan', 'vic', 'wallan-vic'),
  ('au', 'Wangaratta', 'wangaratta', 'vic', 'wangaratta-vic'),
  ('au', 'Warragul', 'warragul', 'vic', 'warragul-vic'),
  ('au', 'Warrnambool', 'warrnambool', 'vic', 'warrnambool-vic'),
  ('au', 'Whittlesea', 'whittlesea', 'vic', 'whittlesea-vic'),
  ('au', 'Wodonga', 'wodonga', 'vic', 'wodonga-vic'),
  ('au', 'Wonga Park', 'wonga-park', 'vic', 'wonga-park-vic'),
  ('au', 'Wonthaggi', 'wonthaggi', 'vic', 'wonthaggi-vic'),
  ('au', 'Woori Yallock - Launching Place', 'woori-yallock---launching-place', 'vic', 'woori-yallock---launching-place-vic'),
  ('au', 'Yarrawonga', 'yarrawonga', 'vic', 'yarrawonga-vic')
on conflict (city_name, country) do nothing;

-- Western Australia (wa)
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  ('au', 'Albany', 'albany', 'wa', 'albany-wa'),
  ('au', 'Baldivis', 'baldivis', 'wa', 'baldivis-wa'),
  ('au', 'Broome', 'broome', 'wa', 'broome-wa'),
  ('au', 'Bunbury', 'bunbury', 'wa', 'bunbury-wa'),
  ('au', 'Busselton', 'busselton', 'wa', 'busselton-wa'),
  ('au', 'Collie', 'collie', 'wa', 'collie-wa'),
  ('au', 'Dardanup', 'dardanup', 'wa', 'dardanup-wa'),
  ('au', 'Dunsborough', 'dunsborough', 'wa', 'dunsborough-wa'),
  ('au', 'Ellenbrook', 'ellenbrook', 'wa', 'ellenbrook-wa'),
  ('au', 'Esperance', 'esperance', 'wa', 'esperance-wa'),
  ('au', 'Geraldton', 'geraldton', 'wa', 'geraldton-wa'),
  ('au', 'Herne Hill', 'herne-hill', 'wa', 'herne-hill-wa'),
  ('au', 'Kalgoorlie - Boulder', 'kalgoorlie---boulder', 'wa', 'kalgoorlie---boulder-wa'),
  ('au', 'Karratha', 'karratha', 'wa', 'karratha-wa'),
  ('au', 'Manjimup', 'manjimup', 'wa', 'manjimup-wa'),
  ('au', 'Margaret River', 'margaret-river', 'wa', 'margaret-river-wa'),
  ('au', 'Northam', 'northam', 'wa', 'northam-wa'),
  ('au', 'Perth', 'perth', 'wa', 'perth-wa'),
  ('au', 'Pinjarra', 'pinjarra', 'wa', 'pinjarra-wa'),
  ('au', 'Port Hedland', 'port-hedland', 'wa', 'port-hedland-wa'),
  ('au', 'Yanchep', 'yanchep', 'wa', 'yanchep-wa')
on conflict (city_name, country) do nothing;