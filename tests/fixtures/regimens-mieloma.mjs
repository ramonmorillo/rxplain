// Esquemas de mieloma del catálogo eliminado (RxPlain ya no incluye catálogo). Se conservan solo como
// fixtures de pruebas: pautas multifase con estado "pendiente" para ejercitar el motor y la hoja.
export const drd = {
  "id": "mieloma-drd",
  "nombre": "DRd",
  "area": "Hematología",
  "linea": "1ª línea · no candidatos",
  "ensayo": "MAIA",
  "estado": "pendiente",
  "fecha_revision": null,
  "fuente": "Pestaña Esquemas del Excel de costes de mieloma múltiple del Servicio (vía artefacto HematoFH)",
  "ciclos_defecto": 12,
  "continuo": true,
  "supuestos": [
    "Dos tonos de rojo en el Excel interpretados como dexametasona fraccionada: 20 mg el día de daratumumab (premedicación en hospital) + 20 mg al día siguiente en casa",
    "La demo original permitía alternar daratumumab/isatuximab entre vía SC e IV; ese cambio se ha eliminado y se muestra la vía almacenada."
  ],
  "fases": [
    {
      "desde": 1,
      "hasta": 2,
      "duracion": 28,
      "etiqueta": "C1–2",
      "items": [
        {
          "farmaco": "Lenalidomida",
          "abrev": "Len",
          "dosis": "25 mg",
          "lugar": "casa",
          "dias": [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            9,
            10,
            11,
            12,
            13,
            14,
            15,
            16,
            17,
            18,
            19,
            20,
            21
          ]
        },
        {
          "farmaco": "Dexametasona",
          "abrev": "Dex",
          "dosis": "20 mg",
          "lugar": "hospital",
          "dias": [
            1,
            8,
            15,
            22
          ],
          "etiqueta": "premed."
        },
        {
          "farmaco": "Dexametasona",
          "abrev": "Dex",
          "dosis": "20 mg",
          "lugar": "casa",
          "dias": [
            2,
            9,
            16,
            23
          ]
        },
        {
          "farmaco": "Daratumumab SC",
          "abrev": "Dara",
          "dosis": "1800 mg",
          "lugar": "hospital",
          "dias": [
            1,
            8,
            15,
            22
          ]
        }
      ]
    },
    {
      "desde": 3,
      "hasta": 6,
      "duracion": 28,
      "etiqueta": "C3–6",
      "items": [
        {
          "farmaco": "Lenalidomida",
          "abrev": "Len",
          "dosis": "25 mg",
          "lugar": "casa",
          "dias": [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            9,
            10,
            11,
            12,
            13,
            14,
            15,
            16,
            17,
            18,
            19,
            20,
            21
          ]
        },
        {
          "farmaco": "Dexametasona",
          "abrev": "Dex",
          "dosis": "20 mg",
          "lugar": "hospital",
          "dias": [
            1,
            15
          ],
          "etiqueta": "premed."
        },
        {
          "farmaco": "Dexametasona",
          "abrev": "Dex",
          "dosis": "20 mg",
          "lugar": "casa",
          "dias": [
            2,
            16
          ]
        },
        {
          "farmaco": "Daratumumab SC",
          "abrev": "Dara",
          "dosis": "1800 mg",
          "lugar": "hospital",
          "dias": [
            1,
            15
          ]
        }
      ]
    },
    {
      "desde": 7,
      "hasta": null,
      "duracion": 28,
      "etiqueta": "C7 en adelante",
      "items": [
        {
          "farmaco": "Lenalidomida",
          "abrev": "Len",
          "dosis": "25 mg",
          "lugar": "casa",
          "dias": [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            9,
            10,
            11,
            12,
            13,
            14,
            15,
            16,
            17,
            18,
            19,
            20,
            21
          ]
        },
        {
          "farmaco": "Dexametasona",
          "abrev": "Dex",
          "dosis": "20 mg",
          "lugar": "hospital",
          "dias": [
            1
          ],
          "etiqueta": "premed."
        },
        {
          "farmaco": "Dexametasona",
          "abrev": "Dex",
          "dosis": "20 mg",
          "lugar": "casa",
          "dias": [
            2
          ]
        },
        {
          "farmaco": "Daratumumab SC",
          "abrev": "Dara",
          "dosis": "1800 mg",
          "lugar": "hospital",
          "dias": [
            1
          ]
        }
      ]
    }
  ]
};
export const vrdSwog = {
  "id": "mieloma-vrd-swog",
  "nombre": "VRD (SWOG)",
  "area": "Hematología",
  "linea": "1ª línea · no candidatos",
  "estado": "pendiente",
  "fecha_revision": null,
  "fuente": "Pestaña Esquemas del Excel de costes de mieloma múltiple del Servicio (vía artefacto HematoFH)",
  "ciclos_defecto": 8,
  "fases": [
    {
      "desde": 1,
      "hasta": null,
      "duracion": 21,
      "etiqueta": "Todos los ciclos",
      "items": [
        {
          "farmaco": "Bortezomib SC",
          "abrev": "Btz",
          "dosis": "1,3 mg/m²",
          "lugar": "hospital",
          "dias": [
            1,
            4,
            8,
            11
          ]
        },
        {
          "farmaco": "Lenalidomida",
          "abrev": "Len",
          "dosis": "25 mg",
          "lugar": "casa",
          "dias": [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            9,
            10,
            11,
            12,
            13,
            14
          ]
        },
        {
          "farmaco": "Dexametasona",
          "abrev": "Dex",
          "dosis": "20 mg",
          "lugar": "casa",
          "dias": [
            1,
            2,
            4,
            5,
            8,
            9,
            11,
            12
          ]
        }
      ]
    }
  ]
};
export const isaKd = {
  "id": "mieloma-isa-kd",
  "nombre": "Isa-Kd",
  "area": "Hematología",
  "linea": "2ª línea",
  "ensayo": "IKEMA",
  "estado": "pendiente",
  "fecha_revision": null,
  "fuente": "Pestaña Esquemas del Excel de costes de mieloma múltiple del Servicio (vía artefacto HematoFH)",
  "ciclos_defecto": 12,
  "supuestos": [
    "Dexametasona 20 mg por día marcado",
    "La demo original permitía alternar daratumumab/isatuximab entre vía SC e IV; ese cambio se ha eliminado y se muestra la vía almacenada."
  ],
  "fases": [
    {
      "desde": 1,
      "hasta": 1,
      "duracion": 28,
      "etiqueta": "C1",
      "items": [
        {
          "farmaco": "Isatuximab IV",
          "abrev": "Isa",
          "dosis": "10 mg/kg",
          "lugar": "hospital",
          "dias": [
            1,
            8,
            15,
            22
          ]
        },
        {
          "farmaco": "Carfilzomib IV",
          "abrev": "Cfz",
          "dosis": "20 mg/m²",
          "lugar": "hospital",
          "dias": [
            1,
            2
          ]
        },
        {
          "farmaco": "Carfilzomib IV",
          "abrev": "Cfz",
          "dosis": "56 mg/m²",
          "lugar": "hospital",
          "dias": [
            8,
            9,
            15,
            16
          ]
        },
        {
          "farmaco": "Dexametasona",
          "abrev": "Dex",
          "dosis": "20 mg",
          "lugar": "casa",
          "dias": [
            1,
            2,
            8,
            9,
            15,
            16,
            22
          ]
        }
      ]
    },
    {
      "desde": 2,
      "hasta": null,
      "duracion": 28,
      "etiqueta": "C2 en adelante",
      "items": [
        {
          "farmaco": "Isatuximab IV",
          "abrev": "Isa",
          "dosis": "10 mg/kg",
          "lugar": "hospital",
          "dias": [
            1,
            15
          ]
        },
        {
          "farmaco": "Carfilzomib IV",
          "abrev": "Cfz",
          "dosis": "56 mg/m²",
          "lugar": "hospital",
          "dias": [
            1,
            2,
            8,
            9,
            15,
            16
          ]
        },
        {
          "farmaco": "Dexametasona",
          "abrev": "Dex",
          "dosis": "20 mg",
          "lugar": "casa",
          "dias": [
            1,
            2,
            8,
            9,
            15,
            16
          ]
        }
      ]
    }
  ]
};
