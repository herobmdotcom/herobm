import subprocess
cmds = [
    "INSERT INTO modbm_core.schema_migrations (filename) VALUES ('0053_melted_warbound.sql') ON CONFLICT DO NOTHING;",
    "INSERT INTO modbm_core.schema_migrations (filename) VALUES ('0054_perpetual_scalphunter.sql') ON CONFLICT DO NOTHING;",
    "INSERT INTO modbm_core.schema_migrations (filename) VALUES ('0055_perfect_spectrum.sql') ON CONFLICT DO NOTHING;",
    "INSERT INTO modbm_core.schema_migrations (filename) VALUES ('0056_intra_transit_bins.sql') ON CONFLICT DO NOTHING;",
    "INSERT INTO modbm_core.schema_migrations (filename) VALUES ('0057_purple_iron_patriot.sql') ON CONFLICT DO NOTHING;",
    "INSERT INTO modbm_core.schema_migrations (filename) VALUES ('0058_glamorous_catseye.sql') ON CONFLICT DO NOTHING;",
    "INSERT INTO modbm_core.schema_migrations (filename) VALUES ('0059_naive_mariko_yashida.sql') ON CONFLICT DO NOTHING;"
]
for cmd in cmds:
    subprocess.run(['podman', 'exec', '-i', 'postgres-custom', 'psql', '-U', 'postgres', '-d', 'custom_app', '-c', cmd])
