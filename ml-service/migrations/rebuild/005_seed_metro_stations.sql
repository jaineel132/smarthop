-- SmartHop Permanent Rebuild
-- Phase 4: Seed all 42 Mumbai metro stations used by frontend.
-- Run after 004_rls_and_realtime.sql.

BEGIN;

INSERT INTO public.metro_stations (id, name, line, lat, lng)
VALUES
  -- Line 1
  ('3141aff4-1e4a-4633-96ff-bcb82a7efa3c', 'Versova', 'Line 1', 19.1307000, 72.8194000),
  ('8c049bdd-5cbe-4a48-9e67-d15d3fcf196b', 'D.N. Nagar', 'Line 1', 19.1207000, 72.8311000),
  ('4aa9e463-a667-48f7-9758-74d45b01a4c6', 'Azad Nagar', 'Line 1', 19.1262000, 72.8382000),
  ('985ca4d1-80bc-4516-b20c-f463b36721ec', 'Andheri', 'Line 1', 19.1197000, 72.8466000),
  ('28156388-9258-456e-892e-5e666f6fda34', 'Western Express Highway', 'Line 1', 19.1118000, 72.8560000),
  ('69232da3-613b-4a2b-ab95-aa012f39d8a5', 'Chakala', 'Line 1', 19.1043000, 72.8609000),
  ('5f54f16e-748c-4f6a-a352-1e851a5b3815', 'Airport Road', 'Line 1', 19.0968000, 72.8654000),
  ('225c9324-f0b3-41ef-8e98-ed0d93506aeb', 'Marol Naka', 'Line 1', 19.0917000, 72.8740000),
  ('66c4560c-324e-4eee-b39e-8a86a2225cff', 'Saki Naka', 'Line 1', 19.0876000, 72.8834000),
  ('dd0cec05-48aa-4f53-92c2-f84f09cc899d', 'Asalpha', 'Line 1', 19.0847000, 72.8930000),
  ('55bd8474-b296-4f62-8373-a7475600ad83', 'Jagruti Nagar', 'Line 1', 19.0855000, 72.9006000),
  ('fb98c995-aaf2-4874-bcb3-42afde07ccd3', 'Ghatkopar', 'Line 1', 19.0860000, 72.9081000),

  -- Line 2A
  ('8dd17889-ba73-4937-a110-392ba187e03f', 'Dahisar East', 'Line 2A', 19.2482000, 72.8574000),
  ('237432a7-7540-4634-b487-99e22e82566f', 'Anand Nagar', 'Line 2A', 19.2389000, 72.8530000),
  ('7862e3c9-6d43-4268-aae6-30f0acd7f51b', 'Kandarpada', 'Line 2A', 19.2290000, 72.8492000),
  ('cec5526c-7e96-44ac-bc8b-2860182d88a8', 'Mandapeshwar', 'Line 2A', 19.2198000, 72.8461000),
  ('aa83632c-8ec4-48b5-8f00-2d2ea90d1926', 'Eksar', 'Line 2A', 19.2089000, 72.8433000),
  ('ef2563fb-c30f-47eb-90e0-bada27fcef51', 'Borivali West', 'Line 2A', 19.2302000, 72.8545000),
  ('02554ad1-34a3-4cd5-ae30-8ed9403676a0', 'Pahadi Eksar', 'Line 2A', 19.1980000, 72.8412000),
  ('a0df83d8-3709-4522-b95d-7a326078403e', 'Kandivali West', 'Line 2A', 19.2053000, 72.8368000),
  ('fd950514-de9d-4f4e-afb6-f7ed0d014184', 'Dahanukarwadi', 'Line 2A', 19.1921000, 72.8389000),
  ('dab16306-fefd-4b93-973c-7412a6efa983', 'Valnai', 'Line 2A', 19.1820000, 72.8365000),
  ('6e01a585-90de-4147-a1f0-023afdcef873', 'Malad West', 'Line 2A', 19.1864000, 72.8489000),
  ('b8cd982f-c247-47bf-b737-af9342a26c9a', 'Lower Malad', 'Line 2A', 19.1776000, 72.8442000),
  ('afdcb330-3bd6-4f21-b195-785c187844d7', 'Pahadi Goregaon', 'Line 2A', 19.1700000, 72.8415000),
  ('2d0b660a-10f7-46a6-87bb-d2f19ee54c59', 'Goregaon West', 'Line 2A', 19.1594000, 72.8318000),
  ('636c2b67-d3be-40f8-b983-33a2e91408c7', 'Oshiwara', 'Line 2A', 19.1498000, 72.8295000),
  ('0ff2053b-4b17-46f1-bebd-c3558e3a80d6', 'Lower Oshiwara', 'Line 2A', 19.1402000, 72.8302000),
  ('fff15492-305c-4f67-a6ac-46c354675c63', 'Andheri West', 'Line 2A', 19.1207000, 72.8311000),

  -- Line 7
  ('0fa35fc6-81b9-4669-9231-950d855124f2', 'Dahisar East', 'Line 7', 19.2497000, 72.8697000),
  ('3692c3c3-bb89-4292-b401-323cc2785b69', 'Ovaripada', 'Line 7', 19.2389000, 72.8626000),
  ('50146dc7-546b-4088-a898-4d463fbdd7a0', 'Devipada', 'Line 7', 19.2320000, 72.8574000),
  ('2b7e63bc-b609-4a24-a917-a2e6bc9eeda2', 'Magathane', 'Line 7', 19.2250000, 72.8572000),
  ('070a831e-6d87-4d7d-8f36-7604886a9b07', 'Poisar', 'Line 7', 19.2140000, 72.8570000),
  ('d39bbcd4-5029-4d66-a6ff-aa0bae3bf762', 'Akurli', 'Line 7', 19.2030000, 72.8562000),
  ('631e22d4-0c2c-49af-801f-de2d555fa10c', 'Kurar', 'Line 7', 19.1920000, 72.8548000),
  ('9d4c098b-bcdc-4989-8e1e-3be6e4284a36', 'Dindoshi', 'Line 7', 19.1810000, 72.8530000),
  ('cc4ad0ed-9914-4788-b5fd-4ee3c29af242', 'Aarey', 'Line 7', 19.1709000, 72.8417000),
  ('b62a1aa7-ab31-44fd-a790-bcb6485bb65b', 'Goregaon East', 'Line 7', 19.1480000, 72.8650000),
  ('ea036569-983d-4832-beaf-aeb17a5cf26e', 'Jogeshwari East', 'Line 7', 19.1341000, 72.8496000),
  ('2daf9eb4-13a3-45f2-8290-df999333858d', 'Shankarwadi', 'Line 7', 19.1260000, 72.8710000),
  ('28438cb5-8c83-4ff6-b68d-90d48f2e63fc', 'Gundavali', 'Line 7', 19.1176000, 72.8676000)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  line = EXCLUDED.line,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  updated_at = now();

COMMIT;
