"""Exercise real visible section navigation across desktop and phone shells.

A hidden legacy nav button must never stand in for user-reachable navigation.
The phone uses the existing More/command-palette path to reach secondary views.
"""

def open_section(page, section):
    """Navigate to a source-backed section using the same controls a user sees."""
    direct = page.locator(f'#nav button[data-go="{section}"]')
    if direct.is_visible():
        direct.click()
    else:
        more = page.locator('#nav [data-more-sections]')
        assert more.is_visible(), f'No visible navigation to {section}'
        more.click()
        page.locator(f'#palette [data-palette-result="{section}"]').click()
    assert page.locator('#view').get_attribute('class') == 'page-' + section, f'Navigation failed: {section}'
