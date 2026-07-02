ffmpeg -y -i '/mnt/d/Videos/屏幕录制/屏幕录制 2026-07-02 154913.mp4' \
  -vf "fps=15,scale=960:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" \
  '/mnt/d/plugin/Portab/screenshots/demo.gif'
