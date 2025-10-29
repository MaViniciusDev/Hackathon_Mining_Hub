#!/usr/bin/env python3
"""
Gera mocks adicionais a partir de `public_mocks_20.json` para popular o mapa de apresentação.

Cria `public_mocks_more.json` com N entradas (default 80) derivadas dos 20 base,
aplicando jitter nas coordenadas e variações em nome, mineral e tamanhos.
Depois mescla automaticamente em `areas_enriched.json` (append) para uso no site.

Uso:
  python3 scripts/generate_more_mocks.py --count 80

"""
import json
import random
from pathlib import Path
import argparse


MINERAL_STATS = {
    'Ferro': (100, 50000),
    'Cobre': (50, 20000),
    'Ouro': (10, 5000),
    'Lítio': (5, 2000),
    'Grafita': (5, 1500),
    'Nióbio': (50, 10000),
    'Urânio': (10, 5000),
    'Fosfato': (20, 8000),
    'Sílica': (5, 2000),
    'Desconhecido': (1, 10000)
}


def load_json(p):
    return json.loads(Path(p).read_text())


def save_json(p, data):
    Path(p).write_text(json.dumps(data, indent=2, ensure_ascii=False))


def pick_mineral(base):
    # sometimes keep base mineral, sometimes choose related one
    if random.random() < 0.7 and base:
        return base
    return random.choice(list(MINERAL_STATS.keys()))


def gen_entry(idx, base):
    lat, lon = base.get('coordinates', [0, 0])
    # jitter up to ~0.5 degrees (roughly <55km)
    jitter_lat = lat + random.uniform(-0.5, 0.5)
    jitter_lon = lon + random.uniform(-0.5, 0.5)
    mineral = pick_mineral(base.get('mineral'))
    area_min, area_max = MINERAL_STATS.get(mineral, (10, 1000))
    hectares = int(random.uniform(area_min, area_max))
    name = f"{base.get('name')} - MockExt {idx}"
    entry = {
        'id': f'BR-MOCK-{1000+idx}',
        'name': name,
        'mineral': mineral,
        'coordinates': [round(jitter_lat, 6), round(jitter_lon, 6)],
        'location': base.get('location', '') + ' (mock)',
        'company': None,
        'status': 'Prospeção',
        'area_hectares': hectares,
        'concession_period': None,
        'estimated_production_tpa': None,
        'reserves_estimate': None,
        'source': base.get('source_url') or base.get('source') or 'synthetic',
        'synthetic': True,
        'note': 'Gerado automaticamente para apresentação. Coordenadas aproximadas.'
    }
    return entry


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--count', type=int, default=80)
    args = parser.parse_args()
    base = Path(__file__).resolve().parent.parent
    public20 = load_json(base / 'public_mocks_20.json')
    enriched = load_json(base / 'areas_enriched.json')

    more = []
    random.seed(42)
    for i in range(args.count):
        b = random.choice(public20)
        entry = gen_entry(i+1, b)
        more.append(entry)

    save_json(base / 'public_mocks_more.json', more)

    # Append to areas_enriched.json
    enriched.extend(more)
    save_json(base / 'areas_enriched.json', enriched)
    print(f"Generated {len(more)} mock entries and merged into areas_enriched.json")


if __name__ == '__main__':
    main()
