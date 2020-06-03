export default {
  //Vertices must be in counter clockwise orientation when passed to p2, and the axis get transposed
  //before passing to p2 so we need them in clockwise orientation in this file
  imageCourtWidth:518,
  imageCourtHeight: 79,
  left: [
    {
      value: -10,
      vertices: [
        [67, 3],
        [82, 8],
        [82, 70],
        [67, 74],
      ]
    },

    {
      value: 7,
      vertices: [
        [82, 3],
        [107, 12],
        [107, 39],
        [82, 39],
      ]
    },
    {
      value: 7,
      vertices: [
        [82, 39],
        [107, 39],
        [107, 66],
        [82, 74],
      ]
    },
    {
      value: 8,
      vertices: [
        [107, 12],
        [137, 24],
        [137, 39],
        [107, 39],
      ]
    },

    {
      value: 8,
      vertices: [
        [107, 39],
        [137, 39],
        [137, 54],
        [107, 66],


      ]
    },
    {
      value: 10,
      vertices: [
        [137, 24],
        [171, 39],
        [137, 54],
      ]
    }
  ],
  right: [

  ],
  leftLineX: 196
}
