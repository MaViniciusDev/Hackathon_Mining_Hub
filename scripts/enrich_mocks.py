#!/usr/bin/env python3
"""
Enriquece arquivos de mock usando a API do Wikidata.

Para cada entrada em `wikidata_entities_mock.json` e `company_registry_mock.json` tentamos encontrar
uma entidade correspondente no Wikidata e, se disponível, adicionar `wikidata_id`, `wikidata_url` e
`coordinates` (campo P625) ao JSON.

Uso: python3 scripts/enrich_mocks.py
"""
import json
import urllib.request
import urllib.parse
import time
from pathlib import Path

API_BASE = "https://www.wikidata.org/w/api.php"


def wikidata_search(label, language='pt'):
    q = urllib.parse.quote(label)
    url = f"{API_BASE}?action=wbsearchentities&search={q}&language={language}&format=json&limit=1"
    req = urllib.request.Request(url, headers={'User-Agent': 'HackathonMock/1.0 (+https://example.org)'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.load(resp)


def wikidata_getclaims(qid):
    url = f"{API_BASE}?action=wbgetentities&ids={qid}&props=claims&format=json"
    req = urllib.request.Request(url, headers={'User-Agent': 'HackathonMock/1.0 (+https://example.org)'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.load(resp)


def enrich_file(path, key_label='label'):
    base = Path(__file__).resolve().parent.parent
    p = base / path
    if not p.exists():
        print(f"File not found: {path}")
        return
    data = json.loads(p.read_text())
    changed = False
    for entry in data:
        label = entry.get(key_label) or entry.get('company_name') or entry.get('title') or entry.get('name')
        if not label:
            continue
        print(f"Searching Wikidata for: {label}")
        try:
            res = wikidata_search(label)
        except Exception as e:
            print(f"  search error: {e}")
            continue
        match = res.get('search') and res['search'][0] if res.get('search') else None
        if match:
            qid = match.get('id')
            entry['wikidata_id'] = qid
            entry['wikidata_label'] = match.get('label')
            entry['wikidata_description'] = match.get('description')
            entry['wikidata_url'] = f"https://www.wikidata.org/wiki/{qid}"
            # fetch claims
            try:
                claims = wikidata_getclaims(qid)
                ent = claims.get('entities', {}).get(qid, {})
                c = ent.get('claims', {})
                if 'P625' in c:
                    # P625 - coordinate location
                    coords_claim = c['P625'][0].get('mainsnak', {}).get('datavalue', {}).get('value')
                    if coords_claim and 'latitude' in coords_claim:
                        entry['coordinates'] = [coords_claim['latitude'], coords_claim['longitude']]
                        print(f"  found coordinates: {entry['coordinates']}")
                        changed = True
            except Exception as e:
                print(f"  claims error for {qid}: {e}")
            changed = True
        else:
            print("  no match found")
        time.sleep(0.5)  # gentle rate-limit
    if changed:
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        print(f"Updated {path}")
    else:
        print(f"No updates for {path}")


def main():
    enrich_file('wikidata_entities_mock.json', key_label='label')
    enrich_file('company_registry_mock.json', key_label='company_name')
    # anm and cprm mocks are local approximations; we can try to search by title but expect fewer matches
    enrich_file('anm_concessions_mock.json', key_label='title')
    enrich_file('cprm_occurrences_mock.json', key_label='name')
    # public mocks created for presentation
    enrich_file('public_mocks_20.json', key_label='name')


if __name__ == '__main__':
    main()
