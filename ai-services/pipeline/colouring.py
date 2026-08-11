import os
import cv2
import numpy as np


# ============================================================
# GENERATE NUMBER + COLOUR GUIDE
# ============================================================

def generate_colouring(
    input_path,
    output_path,
    number_of_colours=8,
    min_region_area=80
):

    print(
        "\n[Stage 4] Number and colour extraction started"
    )


    # ========================================================
    # 1. READ ORIGINAL COLOURED IMAGE
    # ========================================================

    image_bgr = cv2.imread(
        input_path
    )

    if image_bgr is None:
        raise ValueError(
            f"Could not read colouring image: {input_path}"
        )


    # BGR -> RGB
    colouring_input = cv2.cvtColor(
        image_bgr,
        cv2.COLOR_BGR2RGB
    )


    height, width = colouring_input.shape[:2]


    # ========================================================
    # 2. PREPARE PIXELS FOR K-MEANS
    # ========================================================

    pixels = colouring_input.reshape(
        (-1, 3)
    )

    pixels_float = np.float32(
        pixels
    )


    # ========================================================
    # 3. K-MEANS COLOUR CLUSTERING
    # ========================================================

    criteria = (
        cv2.TERM_CRITERIA_EPS
        +
        cv2.TERM_CRITERIA_MAX_ITER,
        100,
        0.2
    )


    compactness, labels, centers = cv2.kmeans(
        pixels_float,
        number_of_colours,
        None,
        criteria,
        10,
        cv2.KMEANS_PP_CENTERS
    )


    centers = np.uint8(
        centers
    )

    labels = labels.flatten()


    print(
        "Detected colour groups:",
        len(centers)
    )


    # ========================================================
    # 4. SORT COLOURS LIGHT -> DARK
    # ========================================================

    brightness = np.mean(
        centers.astype(
            np.float32
        ),
        axis=1
    )


    sort_order = np.argsort(
        -brightness
    )


    sorted_centers = centers[
        sort_order
    ]


    label_mapping = np.zeros(
        number_of_colours,
        dtype=np.uint8
    )


    for new_label, old_label in enumerate(
        sort_order
    ):

        label_mapping[
            old_label
        ] = new_label


    sorted_labels = label_mapping[
        labels
    ]


    label_map = sorted_labels.reshape(
        height,
        width
    )


    # ========================================================
    # 5. SMOOTH SMALL LABEL NOISE
    # ========================================================

    label_map_smooth = cv2.medianBlur(
        label_map.astype(
            np.uint8
        ),
        5
    )


    # ========================================================
    # 6. CREATE WHITE NUMBERING CANVAS
    # ========================================================

    numbered_colour_guide = np.ones(
        (
            height,
            width,
            3
        ),
        dtype=np.uint8
    ) * 255


    # ========================================================
    # 7. FIND REGION BOUNDARIES
    # ========================================================

    boundary = np.zeros(
        (
            height,
            width
        ),
        dtype=np.uint8
    )


    # Horizontal changes
    boundary[:, 1:] |= (
        label_map_smooth[:, 1:]
        !=
        label_map_smooth[:, :-1]
    )


    # Vertical changes
    boundary[1:, :] |= (
        label_map_smooth[1:, :]
        !=
        label_map_smooth[:-1, :]
    )


    boundary = cv2.dilate(
        boundary,
        np.ones(
            (2, 2),
            np.uint8
        ),
        iterations=1
    )


    # --------------------------------------------------------
    # COLOURED OUTLINE (instead of flat black/grey)
    # Each boundary pixel takes the colour of the region
    # it belongs to, so the outline itself tells the user
    # which colour to use — the interior stays white/empty.
    # --------------------------------------------------------

    colour_lut = sorted_centers.astype(
        np.uint8
    )

    boundary_mask = boundary > 0

    numbered_colour_guide[
        boundary_mask
    ] = colour_lut[
        label_map_smooth[
            boundary_mask
        ]
    ]


    # ========================================================
    # 8. PLACE NUMBERS INSIDE REGIONS
    # ========================================================

    region_count = 0


    for colour_index in range(
        number_of_colours
    ):

        colour_mask = (
            label_map_smooth
            ==
            colour_index
        ).astype(
            np.uint8
        )


        (
            component_count,
            component_labels,
            stats,
            centroids
        ) = cv2.connectedComponentsWithStats(
            colour_mask,
            connectivity=8
        )


        for component_index in range(
            1,
            component_count
        ):

            area = stats[
                component_index,
                cv2.CC_STAT_AREA
            ]


            if area < min_region_area:
                continue


            component_mask = (
                component_labels
                ==
                component_index
            ).astype(
                np.uint8
            )


            # Find safest location for number
            distance = cv2.distanceTransform(
                component_mask,
                cv2.DIST_L2,
                5
            )


            (
                _,
                max_distance,
                _,
                max_location
            ) = cv2.minMaxLoc(
                distance
            )


            # Region too narrow for text
            if max_distance < 3:
                continue


            x, y = max_location


            number_text = str(
                colour_index + 1
            )


            font = (
                cv2.FONT_HERSHEY_SIMPLEX
            )


            font_scale = max(
                0.35,
                min(
                    0.8,
                    max_distance / 12
                )
            )


            thickness = 1


            (
                text_size,
                baseline
            ) = cv2.getTextSize(
                number_text,
                font,
                font_scale,
                thickness
            )


            text_width = (
                text_size[0]
            )

            text_height = (
                text_size[1]
            )


            text_x = int(
                x
                -
                text_width / 2
            )

            text_y = int(
                y
                +
                text_height / 2
            )


            cv2.putText(
                numbered_colour_guide,
                number_text,
                (
                    text_x,
                    text_y
                ),
                font,
                font_scale,
                (
                    30,
                    30,
                    30
                ),
                thickness,
                cv2.LINE_AA
            )


            region_count += 1


    print(
        "Numbered regions:",
        region_count
    )


    # ========================================================
    # 9. CREATE COLOUR PALETTE
    # ========================================================

    palette_width = 360


    palette = np.ones(
        (
            height,
            palette_width,
            3
        ),
        dtype=np.uint8
    ) * 255


    # Title
    cv2.putText(
        palette,
        "COLOUR GUIDE",
        (
            35,
            45
        ),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        (
            20,
            20,
            20
        ),
        2,
        cv2.LINE_AA
    )


    available_height = (
        height - 90
    )


    row_height = max(
        45,
        available_height
        //
        number_of_colours
    )


    corresponding_colours = {}


    for index, rgb_colour in enumerate(
        sorted_centers
    ):

        colour_number = (
            index + 1
        )


        rgb = tuple(
            int(value)
            for value
            in rgb_colour
        )


        corresponding_colours[
            colour_number
        ] = rgb


        y = (
            75
            +
            index
            *
            row_height
        )


        box_top = y

        box_bottom = min(
            y + 35,
            height - 10
        )


        # --------------------------------------------
        # Colour square
        # --------------------------------------------

        cv2.rectangle(
            palette,
            (
                20,
                box_top
            ),
            (
                80,
                box_bottom
            ),
            rgb,
            -1
        )


        cv2.rectangle(
            palette,
            (
                20,
                box_top
            ),
            (
                80,
                box_bottom
            ),
            (
                30,
                30,
                30
            ),
            1
        )


        # --------------------------------------------
        # Number
        # --------------------------------------------

        cv2.putText(
            palette,
            str(
                colour_number
            ),
            (
                100,
                box_top + 27
            ),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (
                20,
                20,
                20
            ),
            2,
            cv2.LINE_AA
        )


        # --------------------------------------------
        # RGB value
        # --------------------------------------------

        r, g, b = rgb


        rgb_text = (
            f"RGB ({r}, {g}, {b})"
        )


        cv2.putText(
            palette,
            rgb_text,
            (
                140,
                box_top + 25
            ),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.42,
            (
                40,
                40,
                40
            ),
            1,
            cv2.LINE_AA
        )


        print(
            f"Colour {colour_number}: "
            f"RGB {rgb}"
        )


    # ========================================================
    # 10. COMBINE NUMBERED IMAGE + PALETTE
    # ========================================================

    separator_width = 8


    separator = np.ones(
        (
            height,
            separator_width,
            3
        ),
        dtype=np.uint8
    ) * 220


    final_colouring_guide = np.hstack(
        (
            numbered_colour_guide,
            separator,
            palette
        )
    )


    # ========================================================
    # 11. SAVE FINAL OUTPUT
    # ========================================================

    os.makedirs(
        os.path.dirname(
            output_path
        ),
        exist_ok=True
    )


    # RGB -> BGR before OpenCV save
    output_bgr = cv2.cvtColor(
        final_colouring_guide,
        cv2.COLOR_RGB2BGR
    )


    success = cv2.imwrite(
        output_path,
        output_bgr
    )


    if not success:

        raise IOError(
            f"Could not save colouring output: "
            f"{output_path}"
        )


    print(
        "[Stage 4] Colouring output saved:",
        output_path
    )


    return {
        "numbered_guide":
            numbered_colour_guide,

        "palette":
            palette,

        "final_guide":
            final_colouring_guide,

        "colours":
            corresponding_colours
    }