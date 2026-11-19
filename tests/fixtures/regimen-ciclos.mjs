// Pauta SINTÉTICA de prueba (no es una pauta clínica; los nombres son etiquetas).
export const regimenCiclos = {
  tipo: "ciclos",
  nombre: "Prueba por ciclos",
  fases: [
    {
      desde: 1,
      hasta: 2,
      duracion: 28,
      etiqueta: "Fase A",
      items: [
        {
          farmaco: "Len",
          abrev: "L",
          dosis: "dosis-texto-L",
          lugar: "casa",
          dias: Array.from({ length: 21 }, (_, i) => i + 1),
          etiqueta: "diario"
        },
        {
          farmaco: "Dara",
          abrev: "D",
          dosis: "dosis-texto-D",
          lugar: "hospital",
          dias: [1, 8, 15, 22, 40]
        }
      ]
    },
    {
      desde: 3,
      hasta: null,
      duracion: 28,
      etiqueta: "Fase B",
      items: [
        {
          farmaco: "Dara",
          abrev: "D",
          dosis: "dosis-texto-D",
          veces_al_dia: 2,
          lugar: "hospital",
          dias: [1, 15]
        }
      ]
    }
  ]
};
