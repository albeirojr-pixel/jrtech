import re

with open('apps-script/Code_v5.gs', 'r') as f:
    content = f.read()

# Extract the body of getCatalogData to use as getLaptopStyleData
catalog_func_regex = re.compile(r"function getCatalogData\(\) \{.*?(?=function getEscritorioData\(\) \{)", re.DOTALL)
escritorio_func_regex = re.compile(r"function getEscritorioData\(\) \{.*?(?=function getCelularesData\(\) \{)", re.DOTALL)

match_catalog = catalog_func_regex.search(content)
match_escritorio = escritorio_func_regex.search(content)

if match_catalog and match_escritorio:
    catalog_code = match_catalog.group(0)
    
    # Create getLaptopStyleData from getCatalogData
    laptop_code = catalog_code.replace("function getCatalogData() {", "function getLaptopStyleData(sheetName, cacheKey, idPrefix) {")
    laptop_code = laptop_code.replace("'catalog_portatiles'", "cacheKey")
    laptop_code = laptop_code.replace('"PORTATILES"', "sheetName")
    laptop_code = laptop_code.replace('"ITM" + i', "idPrefix + i")
    
    new_functions = """function getCatalogData() {
  return getLaptopStyleData('PORTATILES', 'catalog_portatiles', 'ITM');
}

function getEscritorioData() {
  return getLaptopStyleData('ESCRITORIO', 'catalog_escritorio', 'ESC');
}

""" + laptop_code

    # Replace both original functions with the new functions
    new_content = content[:match_catalog.start()] + new_functions + content[match_escritorio.end():]
    
    with open('apps-script/Code_v5.gs', 'w') as f:
        f.write(new_content)
    print("Refactor success")
else:
    print("Regex failed to match")
